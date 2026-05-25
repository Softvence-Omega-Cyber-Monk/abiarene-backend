import { BadRequestException, Injectable } from '@nestjs/common';
import { PaymentMethod, Prisma } from '@prisma/client';
import { buildPaginatedResponse } from '../../../common/utils/pagination.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { NotificationsService } from '../../notifications/notifications.service.js';
import {
  CashierCheckoutDto,
  CreateTablesDto,
  ListTablesDto,
  SetTableItemsDto,
  UpdateTablesDto,
} from '../tables.dto.js';

@Injectable()
export class TenantTablesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private toMoney(value: number) {
    return Math.round(value * 100) / 100;
  }

  async create(tenantId: string, dto: CreateTablesDto) {
    try {
      const table = await this.prisma.table.create({
        data: { ...dto, tenantId } as any,
      });
      return this.read(tenantId, table.id);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(
          'Table number already exists for this tenant',
        );
      }

      throw error;
    }
  }

  async list(tenantId: string, dto: ListTablesDto) {
    const where = { tenantId } as any;
    const [tables, total] = await Promise.all([
      this.prisma.table.findMany({
        where,
        skip: (dto.page - 1) * dto.limit,
        take: dto.limit,
        orderBy: { createdAt: 'desc' } as any,
      }),
      this.prisma.table.count({ where }),
    ]);

    return buildPaginatedResponse(tables, dto.page, dto.limit, total);
  }

  read(tenantId: string, id: string) {
    return this.prisma.table.findFirst({
      where: { tenantId, id } as any,
    });
  }

  async update(tenantId: string, id: string, dto: UpdateTablesDto) {
    const data = {
      ...dto,
      ...(dto.status === 'AVAILABLE' && dto.served === undefined
        ? { served: false }
        : {}),
    };

    await this.prisma.table.updateMany({
      where: { tenantId, id } as any,
      data: data as any,
    });
    return this.read(tenantId, id);
  }

  delete(tenantId: string, id: string) {
    return this.prisma.table.deleteMany({ where: { tenantId, id } as any });
  }

  async getCashierSummary(tenantId: string, id: string) {
    const table: any = await this.prisma.table.findFirst({
      where: { tenantId, id } as any,
      select: {
        id: true,
        tenantId: true,
        tableNumber: true,
        seatCount: true,
        status: true,
        served: true,
        orders: {
          where: {
            status: { notIn: ['COMPLETED', 'CANCELLED'] },
          },
          select: {
            id: true,
            status: true,
            createdAt: true,
            items: {
              select: {
                quantity: true,
                menuItem: {
                  select: {
                    id: true,
                    name: true,
                    price: true,
                    image: true,
                    category: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!table) {
      throw new BadRequestException('Table not found for this tenant');
    }

    const itemMap = new Map<
      string,
      {
        itemId: string;
        name: string;
        category: string;
        image: string | null;
        quantity: number;
        unitPrice: number;
        lineTotal: number;
      }
    >();

    let totalAmount = 0;
    let totalQuantity = 0;

    for (const order of table.orders) {
      for (const item of order.items) {
        const lineTotal = item.quantity * item.menuItem.price;
        totalAmount += lineTotal;
        totalQuantity += item.quantity;

        const existing = itemMap.get(item.menuItem.id);
        if (existing) {
          existing.quantity += item.quantity;
          existing.lineTotal += lineTotal;
          continue;
        }

        itemMap.set(item.menuItem.id, {
          itemId: item.menuItem.id,
          name: item.menuItem.name,
          category: item.menuItem.category,
          image: item.menuItem.image,
          quantity: item.quantity,
          unitPrice: item.menuItem.price,
          lineTotal,
        });
      }
    }

    const items = [...itemMap.values()];
    const discounts = await this.prisma.discount.findMany({
      where: { tenantId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    return {
      table: {
        id: table.id,
        tenantId: table.tenantId,
        tableNumber: table.tableNumber,
        seatCount: table.seatCount,
        status: table.status,
        served: table.served,
      },
      orders: table.orders.map((order) => ({
        id: order.id,
        status: order.status,
        createdAt: order.createdAt,
        itemCount: order.items.length,
        totalQuantity: order.items.reduce(
          (sum, item) => sum + item.quantity,
          0,
        ),
        totalAmount: order.items.reduce(
          (sum, item) => sum + item.quantity * item.menuItem.price,
          0,
        ),
      })),
      items,
      discounts: discounts.map((discount) => ({
        id: discount.id,
        name: discount.name,
        minimumPrice: discount.minimumPrice,
        offPrice: discount.offPrice,
        isActive: discount.isActive,
        eligible: totalAmount >= discount.minimumPrice,
      })),
      meta: {
        orderCount: table.orders.length,
        itemCount: items.length,
        totalQuantity,
        totalAmount: this.toMoney(totalAmount),
      },
    };
  }

  async completeCashierCheckout(
    tenantId: string,
    id: string,
    dto: CashierCheckoutDto,
  ) {
    if (![PaymentMethod.CASH, PaymentMethod.CARD].includes(dto.method)) {
      throw new BadRequestException(
        'Only CASH or CARD is allowed for cashier checkout',
      );
    }

    const table: any = await this.prisma.table.findFirst({
      where: { tenantId, id } as any,
      select: {
        id: true,
        tableNumber: true,
        orders: {
          where: {
            status: { notIn: ['COMPLETED', 'CANCELLED'] },
          },
          select: {
            id: true,
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
          },
        },
      },
    });

    if (!table) {
      throw new BadRequestException('Table not found for this tenant');
    }

    if (table.orders.length === 0) {
      throw new BadRequestException('No active orders found for this table');
    }

    const orderSubtotals = table.orders.map((order) => ({
      orderId: order.id,
      subtotal: this.toMoney(
        order.items.reduce(
          (sum, item) => sum + item.quantity * item.menuItem.price,
          0,
        ),
      ),
    }));

    const subtotalAmount = this.toMoney(
      orderSubtotals.reduce((sum, order) => sum + order.subtotal, 0),
    );

    let appliedDiscount: null | {
      id: string;
      name: string;
      offPrice: number;
      minimumPrice: number;
      discountAmount: number;
    } = null;

    if (dto.discountId) {
      const discount = await this.prisma.discount.findFirst({
        where: {
          id: dto.discountId,
          tenantId,
          isActive: true,
        },
      });

      if (!discount) {
        throw new BadRequestException(
          'Discount not found or inactive for this tenant',
        );
      }

      if (subtotalAmount < discount.minimumPrice) {
        throw new BadRequestException(
          'Order total does not meet the minimum price for this discount',
        );
      }

      appliedDiscount = {
        id: discount.id,
        name: discount.name,
        offPrice: discount.offPrice,
        minimumPrice: discount.minimumPrice,
        discountAmount: this.toMoney(
          subtotalAmount * (discount.offPrice / 100),
        ),
      };
    }

    const subtotalCents = Math.round(subtotalAmount * 100);
    const discountCents = Math.round(
      (appliedDiscount?.discountAmount ?? 0) * 100,
    );
    const netCents = subtotalCents - discountCents;
    let allocatedCents = 0;

    const payments = orderSubtotals.map((order, index) => {
      const orderSubtotalCents = Math.round(order.subtotal * 100);
      const amountCents =
        index === orderSubtotals.length - 1
          ? netCents - allocatedCents
          : Math.round((orderSubtotalCents / subtotalCents) * netCents);

      allocatedCents += amountCents;

      return {
        orderId: order.orderId,
        tenantId,
        amount: this.toMoney(amountCents / 100),
        method: dto.method,
        status: 'COMPLETED' as const,
      };
    });

    await this.prisma.payment.createMany({
      data: payments as any,
    });

    await this.prisma.order.updateMany({
      where: {
        tenantId,
        id: {
          in: table.orders.map((order) => order.id),
        },
      },
      data: {
        status: 'COMPLETED',
      },
    });

    await this.prisma.table.updateMany({
      where: { tenantId, id: table.id },
      data: {
        status: 'AVAILABLE',
      },
    });

    const totalAmount = this.toMoney(
      payments.reduce((sum, payment) => sum + payment.amount, 0),
    );

    await this.notifications.notifyCashierPaymentCompleted({
      tenantId,
      tableId: table.id,
      tableNumber: table.tableNumber,
      paymentMethod: dto.method,
      totalAmount,
      orderCount: table.orders.length,
    });

    return {
      table: await this.read(tenantId, table.id),
      paymentMethod: dto.method,
      discount: appliedDiscount,
      meta: {
        orderCount: table.orders.length,
        subtotalAmount,
        discountAmount: appliedDiscount?.discountAmount ?? 0,
        totalAmount,
      },
    };
  }

  listItems(tenantId: string, id: string) {
    return this.prisma.table
      .findFirst({
        where: { id, tenantId } as any,
        select: { id: true },
      })
      .then(async (table) => {
        if (!table) {
          throw new BadRequestException('Table not found for this tenant');
        }

        const menu = await this.getMenu(tenantId);
        return menu?.items ?? [];
      });
  }

  async setMenu(tenantId: string, dto: SetTableItemsDto) {
    const uniqueItemIds = [...new Set(dto.itemIds)];

    const items = await this.prisma.menuItem.findMany({
      where: {
        tenantId,
        id: { in: uniqueItemIds },
      } as any,
      select: { id: true },
    });

    if (items.length !== uniqueItemIds.length) {
      throw new BadRequestException(
        'One or more items do not belong to this tenant',
      );
    }

    const existingMenu = await this.prisma.menu.findFirst({
      where: { tenantId },
      select: { id: true },
    });

    if (existingMenu) {
      const existingSelections = await this.prisma.menuSelection.findMany({
        where: { menuId: existingMenu.id } as any,
        select: { itemId: true },
      });

      const existingItemIds = new Set(
        existingSelections.map((selection) => selection.itemId),
      );
      const itemIdsToAdd = uniqueItemIds.filter(
        (itemId) => !existingItemIds.has(itemId),
      );

      await this.prisma.menu.update({
        where: { id: existingMenu.id },
        data: {
          name: dto.name,
          items: {
            create: itemIdsToAdd.map((itemId) => ({
              itemId,
            })),
          },
        },
      });
    } else {
      await this.prisma.menu.create({
        data: {
          tenantId,
          name: dto.name,
          items: {
            create: uniqueItemIds.map((itemId) => ({
              itemId,
            })),
          },
        },
      });
    }

    return this.getMenu(tenantId);
  }

  async removeMenuItem(tenantId: string, itemId: string) {
    const menu = await this.prisma.menu.findFirst({
      where: { tenantId },
      select: { id: true },
    });

    if (!menu) {
      throw new BadRequestException('Shared menu not found for this tenant');
    }

    const selection = await this.prisma.menuSelection.findFirst({
      where: {
        menuId: menu.id,
        itemId,
      } as any,
      select: { id: true },
    });

    if (!selection) {
      throw new BadRequestException('Item is not assigned to the shared menu');
    }

    await this.prisma.menuSelection.delete({
      where: { id: selection.id },
    });

    return this.getMenu(tenantId);
  }

  getMenu(tenantId: string) {
    return this.prisma.menu.findFirst({
      where: { tenantId },
      include: {
        items: {
          include: {
            item: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });
  }
}
