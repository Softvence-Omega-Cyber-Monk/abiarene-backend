import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import {
  CreateCashierDirectOrderDto,
  CreateCashierInventoryOrderDto,
  CreateOrdersDto,
  DirectOrderCheckoutDto,
  ListOrdersDto,
  InventoryOrderItemDto,
  OrderItemDto,
  UpdateOrdersDto,
} from './orders.dto.js';
import { TicketsService } from '../tickets/tickets.service.js';
import { buildPaginatedResponse } from '../../common/utils/pagination.js';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ticketsService: TicketsService,
    private readonly notifications: NotificationsService,
  ) {}

  private readonly orderInclude = {
    table: true,
    items: {
      include: {
        menuItem: true,
        product: true,
      },
    },
    tickets: {
      include: {
        items: {
          include: {
            orderItem: {
              include: {
                menuItem: true,
                product: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc' as const,
      },
    },
  };

  private toMoney(value: number) {
    return Math.round(value * 100) / 100;
  }

  private async getTenantCurrencyCode(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { currencyCode: true },
    });

    return tenant?.currencyCode;
  }

  private getOrderItemUnitPrice(item: {
    unitPrice?: number | null;
    menuItem?: { price?: number | null } | null;
    product?: { price?: number | null } | null;
  }) {
    return item.unitPrice ?? item.menuItem?.price ?? item.product?.price ?? 0;
  }

  private resolveOrderItem(item: any, currencyCode?: string) {
    const source = item.menuItem ?? item.product ?? null;
    const itemId = item.menuItemId ?? item.productId ?? source?.id ?? item.id;
    const name = item.itemName ?? source?.name ?? 'Unknown Item';
    const category = item.itemCategory ?? source?.category ?? null;
    const image = item.itemImage ?? source?.image ?? null;
    const unitPrice = this.getOrderItemUnitPrice(item);

    return {
      id: item.id,
      itemId,
      quantity: item.quantity,
      notes: item.notes,
      selectedOptions: item.selectedOptions ?? [],
      item: {
        id: itemId,
        name,
        category,
        price: unitPrice,
        image,
        currencyCode,
      },
      lineTotal: this.toMoney(item.quantity * unitPrice),
      sourceType: item.productId ? 'INVENTORY' : 'MENU',
      currencyCode,
    };
  }

  private formatOrderListItem(order: any, currencyCode?: string) {
    const latestTicket = order.tickets[0] ?? null;
    const items = order.items.map((item: any) =>
      this.resolveOrderItem(item, currencyCode),
    );

    return {
      id: order.id,
      tenantId: order.tenantId,
      tableId: order.tableId,
      orderType: order.orderType,
      status: order.status,
      createdBy: order.createdBy,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      table: order.table,
      items,
      ticket: latestTicket,
      currencyCode,
      meta: {
        itemCount: items.length,
      },
    };
  }

  private formatOrderHistoryItem(order: any, currencyCode?: string) {
    const latestTicket = order.tickets[0] ?? null;
    const items = order.items.map((item: any) =>
      this.resolveOrderItem(item, currencyCode),
    );

    return {
      id: order.id,
      tenantId: order.tenantId,
      tableId: order.tableId,
      orderType: order.orderType,
      status: order.status,
      createdBy: order.createdBy,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      table: order.table,
      items,
      ticket: latestTicket,
      payments: order.payments,
      currencyCode,
      meta: {
        itemCount: items.length,
        totalQuantity: items.reduce((sum: number, item: any) => sum + item.quantity, 0),
        totalPaidAmount: order.payments.reduce(
          (sum: number, payment: any) => sum + payment.amount,
          0,
        ),
      },
    };
  }

  private async prepareOrderItems(tenantId: string, items: OrderItemDto[]) {
    if (items.length === 0) {
      throw new BadRequestException('Add at least one item to create an order');
    }

    const requestedItemIds = [...new Set(items.map((item) => item.itemId))];

    const menu = await this.prisma.menu.findFirst({
      where: { tenantId },
      include: {
        items: {
          where: {
            itemId: { in: requestedItemIds },
          },
          include: {
            item: {
              select: {
                id: true,
                name: true,
                category: true,
                image: true,
                price: true,
                options: true,
              },
            },
          },
        },
      },
    });

    if (!menu || menu.items.length !== requestedItemIds.length) {
      throw new BadRequestException(
        'One or more items are not assigned to the tenant menu',
      );
    }

    const menuItemsById = new Map(
      menu.items.map((selection) => [selection.item.id, selection.item]),
    );

    for (const item of items) {
      const menuItem = menuItemsById.get(item.itemId);
      if (!menuItem) {
        throw new BadRequestException('One or more items are not assigned to the tenant menu');
      }

      const selectedOptions = item.selectedOptions ?? [];
      const invalidOption = selectedOptions.find(
        (option) => !menuItem.options.includes(option),
      );

      if (invalidOption) {
        throw new BadRequestException(
          `Selected option "${invalidOption}" is not available for this item`,
        );
      }
    }

    return items.map((item) => ({
      menuItemId: item.itemId,
      itemName: menuItemsById.get(item.itemId)?.name,
      itemCategory: menuItemsById.get(item.itemId)?.category,
      itemImage: menuItemsById.get(item.itemId)?.image ?? null,
      unitPrice: menuItemsById.get(item.itemId)?.price ?? 0,
      quantity: item.quantity,
      notes: item.notes,
      selectedOptions: item.selectedOptions ?? [],
    }));
  }

  private async prepareInventoryOrderItems(
    tenantId: string,
    items: InventoryOrderItemDto[],
  ) {
    if (items.length === 0) {
      throw new BadRequestException('Add at least one inventory product to create an order');
    }

    const requestedProductIds = [...new Set(items.map((item) => item.productId))];
    const products = await this.prisma.product.findMany({
      where: {
        tenantId,
        id: { in: requestedProductIds },
      } as any,
      select: {
        id: true,
        name: true,
        price: true,
        stock: true,
      },
    });

    if (products.length !== requestedProductIds.length) {
      throw new BadRequestException('One or more inventory products were not found for this tenant');
    }

    const productById = new Map(products.map((product) => [product.id, product]));

    for (const item of items) {
      const product = productById.get(item.productId);
      if (!product) {
        throw new BadRequestException('One or more inventory products were not found for this tenant');
      }

      if (item.quantity <= 0) {
        throw new BadRequestException('Quantity must be greater than zero');
      }

      if (product.stock < item.quantity) {
        throw new BadRequestException(`Not enough stock for ${product.name}`);
      }
    }

    return items.map((item) => {
      const product = productById.get(item.productId)!;

      return {
        productId: product.id,
        itemName: product.name,
        itemCategory: 'Inventory',
        itemImage: null,
        unitPrice: product.price,
        quantity: item.quantity,
        notes: item.notes,
        selectedOptions: [],
      };
    });
  }

  async create(tenantId: string, userId: string, dto: CreateOrdersDto) {
    const table = await this.prisma.table.findFirst({
      where: { id: dto.tableId, tenantId },
      select: { id: true },
    });

    if (!table) {
      throw new BadRequestException('Table not found for this tenant');
    }

    const orderItems = await this.prepareOrderItems(tenantId, dto.items);

    const order = await this.prisma.order.create({
      data: {
        tableId: dto.tableId,
        tenantId,
        orderType: 'DINE_IN',
        createdBy: userId,
        items: {
          create: orderItems as any,
        },
      },
      include: this.orderInclude,
    });

    await this.prisma.table.updateMany({
      where: { id: dto.tableId, tenantId },
      data: { status: 'OCCUPIED', served: false },
    });

    return this.read(tenantId, order.id);
  }

  async createCashierDirect(
    tenantId: string,
    userId: string,
    dto: CreateCashierDirectOrderDto,
  ) {
    const orderItems = await this.prepareOrderItems(tenantId, dto.items);

    const order = await this.prisma.order.create({
      data: {
        tenantId,
        orderType: 'DIRECT',
        createdBy: userId,
        items: {
          create: orderItems as any,
        },
      },
      include: this.orderInclude,
    });

    return this.read(tenantId, order.id);
  }

  async createCashierDirectInventory(
    tenantId: string,
    userId: string,
    dto: CreateCashierInventoryOrderDto,
  ) {
    const orderItems = await this.prepareInventoryOrderItems(tenantId, dto.items);

    const order = await this.prisma.order.create({
      data: {
        tenantId,
        orderType: 'DIRECT',
        createdBy: userId,
        items: {
          create: orderItems as any,
        },
      },
      include: this.orderInclude,
    });

    return this.read(tenantId, order.id);
  }

  async list(tenantId: string, dto: ListOrdersDto) {
    const where = {
      tenantId,
      status: {
        not: 'COMPLETED' as const,
      },
    };

    const [orders, total, currencyCode] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip: (dto.page - 1) * dto.limit,
        take: dto.limit,
        select: {
          id: true,
          tenantId: true,
          tableId: true,
          orderType: true,
          status: true,
          createdBy: true,
          createdAt: true,
          updatedAt: true,
          table: {
            select: {
              id: true,
              tableNumber: true,
              seatCount: true,
              status: true,
            },
          },
          items: {
            select: {
              id: true,
              menuItemId: true,
              productId: true,
              itemName: true,
              itemCategory: true,
              itemImage: true,
              unitPrice: true,
              quantity: true,
              notes: true,
              selectedOptions: true,
              menuItem: {
                select: {
                  id: true,
                  name: true,
                  category: true,
                  price: true,
                  image: true,
                },
              },
              product: {
                select: {
                  id: true,
                  name: true,
                  price: true,
                },
              },
            },
          },
          tickets: {
            select: {
              id: true,
              ticketCode: true,
              status: true,
              createdAt: true,
              updatedAt: true,
            },
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where }),
      this.getTenantCurrencyCode(tenantId),
    ]);

    return buildPaginatedResponse(
      orders.map((order) => this.formatOrderListItem(order, currencyCode)),
      dto.page,
      dto.limit,
      total,
    );
  }

  async listHistory(tenantId: string, dto: ListOrdersDto) {
    const where = {
      tenantId,
      status: 'COMPLETED' as const,
      payments: {
        some: {
          status: 'COMPLETED' as const,
        },
      },
    };

    const [orders, total, currencyCode] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip: (dto.page - 1) * dto.limit,
        take: dto.limit,
        select: {
          id: true,
          tenantId: true,
          tableId: true,
          orderType: true,
          status: true,
          createdBy: true,
          createdAt: true,
          updatedAt: true,
          table: {
            select: {
              id: true,
              tableNumber: true,
              seatCount: true,
              status: true,
              served: true,
            },
          },
          items: {
            select: {
              id: true,
              menuItemId: true,
              productId: true,
              itemName: true,
              itemCategory: true,
              itemImage: true,
              unitPrice: true,
              quantity: true,
              notes: true,
              selectedOptions: true,
              menuItem: {
                select: {
                  id: true,
                  name: true,
                  category: true,
                  price: true,
                  image: true,
                },
              },
              product: {
                select: {
                  id: true,
                  name: true,
                  price: true,
                },
              },
            },
          },
          tickets: {
            select: {
              id: true,
              ticketCode: true,
              status: true,
              createdAt: true,
              updatedAt: true,
            },
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
          payments: {
            where: {
              status: 'COMPLETED',
            },
            select: {
              id: true,
              amount: true,
              method: true,
              status: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.order.count({ where }),
      this.getTenantCurrencyCode(tenantId),
    ]);

    return buildPaginatedResponse(
      orders.map((order) => this.formatOrderHistoryItem(order, currencyCode)),
      dto.page,
      dto.limit,
      total,
    );
  }

  async read(tenantId: string, id: string) {
    const [order, currencyCode] = await Promise.all([
      this.prisma.order.findFirst({
        where: { tenantId, id },
        include: this.orderInclude,
      }),
      this.getTenantCurrencyCode(tenantId),
    ]);

    return order
      ? {
          ...order,
          currencyCode,
        }
      : order;
  }

  async update(tenantId: string, id: string, dto: UpdateOrdersDto) {
    await this.prisma.order.updateMany({ where: { tenantId, id }, data: dto as any });
    const order = await this.read(tenantId, id);

    if (order?.tableId && dto.status) {
      const nextTableStatus =
        dto.status === 'COMPLETED' || dto.status === 'CANCELLED'
          ? 'AVAILABLE'
          : 'OCCUPIED';

      await this.prisma.table.updateMany({
        where: { id: order.tableId, tenantId },
        data: {
          status: nextTableStatus,
          ...(nextTableStatus === 'AVAILABLE' ? { served: false } : {}),
        },
      });
    }

    return order;
  }

  delete(tenantId: string, id: string) { return this.prisma.order.deleteMany({ where: { tenantId, id } }); }

  async cancel(tenantId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { tenantId, id },
      select: {
        id: true,
        tableId: true,
        orderType: true,
        status: true,
        table: {
          select: {
            tableNumber: true,
          },
        },
      },
    });

    if (!order) {
      throw new BadRequestException('Order not found for this tenant');
    }

    if (order.status === 'COMPLETED' || order.status === 'CANCELLED') {
      throw new BadRequestException('Only active orders can be cancelled');
    }

    await this.prisma.order.updateMany({
      where: { tenantId, id },
      data: { status: 'CANCELLED' },
    });

    if (order.tableId) {
      await this.prisma.table.updateMany({
        where: { tenantId, id: order.tableId },
        data: { status: 'AVAILABLE', served: false },
      });
    }

    await this.notifications.notifyOrderCancelled({
      tenantId,
      orderId: order.id,
      tableId: order.tableId,
      tableNumber: order.table?.tableNumber,
      orderType: order.orderType as 'DINE_IN' | 'DIRECT',
    });

    return this.read(tenantId, id);
  }

  async sendToKitchen(tenantId: string, id: string) {
    const order = await this.prisma.order.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        orderType: true,
        table: {
          select: {
            id: true,
            tableNumber: true,
          },
        },
        items: {
          select: { id: true },
        },
        tickets: {
          where: {
            status: {
              in: ['ACTIVE', 'READY'],
            },
          },
          select: { id: true },
        },
      },
    });

    if (!order) {
      throw new BadRequestException('Order not found for this tenant');
    }

    if (order.items.length === 0) {
      throw new BadRequestException('Add at least one item before sending the order to kitchen');
    }

    if (order.tickets.length > 0) {
      throw new BadRequestException('This order already has an active kitchen ticket');
    }

    await this.ticketsService.createKitchenTicket(
      tenantId,
      id,
      order.items.map((item) => item.id),
    );

    await this.prisma.order.updateMany({
      where: { tenantId, id },
      data: { status: 'PREPARING' },
    });

    await this.notifications.notifyOrderSentToKitchen({
      tenantId,
      orderId: order.id,
      tableId: order.table?.id,
      tableNumber: order.table?.tableNumber,
      orderType: order.orderType as 'DINE_IN' | 'DIRECT',
    });

    return this.read(tenantId, id);
  }

  async completeCashierDirectCheckout(
    tenantId: string,
    id: string,
    dto: DirectOrderCheckoutDto,
  ) {
    if (dto.method !== 'CASH' && dto.method !== 'CARD') {
      throw new BadRequestException(
        'Only CASH or CARD is allowed for direct cashier checkout',
      );
    }

    const order = await this.prisma.order.findFirst({
      where: { tenantId, id },
      select: {
        id: true,
        tenantId: true,
        tableId: true,
        orderType: true,
        status: true,
        items: {
          select: {
            id: true,
            productId: true,
            unitPrice: true,
            quantity: true,
            product: {
              select: {
                id: true,
                stock: true,
                price: true,
              },
            },
            menuItem: {
              select: {
                price: true,
              },
            },
          },
        },
        payments: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });

    if (!order) {
      throw new BadRequestException('Order not found for this tenant');
    }

    if (order.orderType !== 'DIRECT') {
      throw new BadRequestException('Use table checkout for dine-in orders');
    }

    if (order.status === 'CANCELLED') {
      throw new BadRequestException('Cancelled orders cannot be checked out');
    }

    if (order.payments.some((payment) => payment.status === 'COMPLETED')) {
      throw new BadRequestException('This direct order has already been checked out');
    }

    if (order.items.length === 0) {
      throw new BadRequestException('No items found for this direct order');
    }

    const subtotal = this.toMoney(
      order.items.reduce(
        (sum, item) => sum + item.quantity * this.getOrderItemUnitPrice(item),
        0,
      ),
    );

    let discountAmount = 0;
    let appliedDiscount: null | {
      id: string;
      name: string;
      minimumPrice: number;
      offPrice: number;
    } = null;

    if (dto.discountId) {
      const discount = await this.prisma.discount.findFirst({
        where: {
          id: dto.discountId,
          tenantId,
          isActive: true,
        },
        select: {
          id: true,
          name: true,
          minimumPrice: true,
          offPrice: true,
        },
      });

      if (!discount) {
        throw new BadRequestException('Discount not found for this tenant');
      }

      if (subtotal < discount.minimumPrice) {
        throw new BadRequestException(
          `This discount requires a minimum spend of ${discount.minimumPrice}`,
        );
      }

      discountAmount = Math.min(discount.offPrice, subtotal);
      appliedDiscount = discount;
    }

    const totalAmount = this.toMoney(Math.max(0, subtotal - discountAmount));

    const inventoryStockNeeded = new Map<string, number>();
    for (const item of order.items) {
      if (!item.productId) {
        continue;
      }

      inventoryStockNeeded.set(
        item.productId,
        (inventoryStockNeeded.get(item.productId) ?? 0) + item.quantity,
      );
    }

    const payment = await this.prisma.$transaction(async (tx) => {
      for (const [productId, requiredQuantity] of inventoryStockNeeded) {
        const currentProduct = await tx.product.findUnique({
          where: { id: productId },
          select: {
            id: true,
            stock: true,
          },
        });

        if (!currentProduct) {
          throw new BadRequestException('Inventory product not found for this order item');
        }

        if (currentProduct.stock < requiredQuantity) {
          throw new BadRequestException('Not enough inventory stock to complete checkout');
        }

        await tx.product.update({
          where: { id: currentProduct.id },
          data: {
            stock: {
              decrement: requiredQuantity,
            },
          },
        });
      }

      const createdPayment = await tx.payment.create({
        data: {
          orderId: order.id,
          tenantId,
          amount: totalAmount,
          status: 'COMPLETED',
          method: dto.method,
        },
      });

      await tx.order.updateMany({
        where: { tenantId, id: order.id },
        data: { status: 'COMPLETED' },
      });

      return createdPayment;
    });

    await this.notifications.notifyCashierPaymentCompleted({
      tenantId,
      tableId: null,
      tableNumber: null,
      orderId: order.id,
      orderType: 'DIRECT',
      paymentMethod: dto.method,
      totalAmount,
      orderCount: 1,
    });

    return {
      payment,
      order: await this.read(tenantId, order.id),
      summary: {
        subtotal,
        discountAmount: this.toMoney(discountAmount),
        totalAmount,
        appliedDiscount,
      },
    };
  }
}
