import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import {
  CreateCashierDirectOrderDto,
  CreateOrdersDto,
  DirectOrderCheckoutDto,
  ListOrdersDto,
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
      },
    },
    tickets: {
      include: {
        items: {
          include: {
            orderItem: {
              include: {
                menuItem: true,
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

  private formatOrderListItem(order: {
    id: string;
    tenantId: string;
    tableId: string | null;
    orderType: string;
    status: string;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
    table: {
      id: string;
      tableNumber: number;
      seatCount: number;
      status: string;
    } | null;
    items: {
      id: string;
      menuItemId: string;
      quantity: number;
      notes: string | null;
      selectedOptions: string[];
      menuItem: {
        id: string;
        name: string;
        category: string;
        price: number;
        image: string | null;
      };
    }[];
    tickets: {
      id: string;
      ticketCode: string;
      status: string;
      createdAt: Date;
      updatedAt: Date;
    }[];
  }) {
    const latestTicket = order.tickets[0] ?? null;

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
      items: order.items.map((item) => ({
        id: item.id,
        itemId: item.menuItemId,
        quantity: item.quantity,
        notes: item.notes,
        selectedOptions: item.selectedOptions,
        item: item.menuItem,
      })),
      ticket: latestTicket,
      meta: {
        itemCount: order.items.length,
      },
    };
  }

  private formatOrderHistoryItem(order: {
    id: string;
    tenantId: string;
    tableId: string | null;
    orderType: string;
    status: string;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
    table: {
      id: string;
      tableNumber: number;
      seatCount: number;
      status: string;
      served?: boolean;
    } | null;
    items: {
      id: string;
      menuItemId: string;
      quantity: number;
      notes: string | null;
      selectedOptions: string[];
      menuItem: {
        id: string;
        name: string;
        category: string;
        price: number;
        image: string | null;
      };
    }[];
    tickets: {
      id: string;
      ticketCode: string;
      status: string;
      createdAt: Date;
      updatedAt: Date;
    }[];
    payments: {
      id: string;
      amount: number;
      method: string;
      status: string;
      createdAt: Date;
    }[];
  }) {
    const latestTicket = order.tickets[0] ?? null;

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
      items: order.items.map((item) => ({
        id: item.id,
        itemId: item.menuItemId,
        quantity: item.quantity,
        notes: item.notes,
        selectedOptions: item.selectedOptions,
        item: item.menuItem,
        lineTotal: item.quantity * item.menuItem.price,
      })),
      ticket: latestTicket,
      payments: order.payments,
      meta: {
        itemCount: order.items.length,
        totalQuantity: order.items.reduce((sum, item) => sum + item.quantity, 0),
        totalPaidAmount: order.payments.reduce(
          (sum, payment) => sum + payment.amount,
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
      quantity: item.quantity,
      notes: item.notes,
      selectedOptions: item.selectedOptions ?? [],
    }));
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
          create: orderItems,
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
          create: orderItems,
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

    const [orders, total] = await Promise.all([
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
    ]);

    return buildPaginatedResponse(
      orders.map((order) => this.formatOrderListItem(order)),
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

    const [orders, total] = await Promise.all([
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
    ]);

    return buildPaginatedResponse(
      orders.map((order) => this.formatOrderHistoryItem(order)),
      dto.page,
      dto.limit,
      total,
    );
  }

  read(tenantId: string, id: string) {
    return this.prisma.order.findFirst({
      where: { tenantId, id },
      include: this.orderInclude,
    });
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
            quantity: true,
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
        (sum, item) => sum + item.quantity * item.menuItem.price,
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

    const payment = await this.prisma.payment.create({
      data: {
        orderId: order.id,
        tenantId,
        amount: totalAmount,
        status: 'COMPLETED',
        method: dto.method,
      },
    });

    await this.prisma.order.updateMany({
      where: { tenantId, id: order.id },
      data: { status: 'COMPLETED' },
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
