import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RoleName } from '../../common/constants/role-name.js';
import { AuthUser } from '../../common/interfaces/auth-user.interface.js';
import { buildPaginatedResponse } from '../../common/utils/pagination.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { ListNotificationsDto } from './notifications.dto.js';
import { NotificationsGateway } from './notifications.gateway.js';

type NotificationPayload = Prisma.JsonObject;
type AppNotificationType =
  | 'ORDER_SENT_TO_KITCHEN'
  | 'ORDER_CANCELLED'
  | 'ORDER_READY'
  | 'ORDER_ARCHIVED'
  | 'PAYMENT_COMPLETED'
  | 'SUBSCRIPTION_PAID'
  | 'GENERIC';

type NotificationActor = AuthUser;

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
  ) {}

  private formatNotification(notification: any) {
    return {
      id: notification.id,
      tenantId: notification.tenantId,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      payload: notification.payload,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
      updatedAt: notification.updatedAt,
    };
  }

  private isAdmin(actor: NotificationActor) {
    return actor.role?.toUpperCase() === RoleName.ADMIN;
  }

  private withLeadershipRoles(roles: RoleName[]) {
    return [...new Set([...roles, RoleName.MANAGER, RoleName.SUPERVISOR])];
  }

  private getOrderLabel(input: {
    orderType?: 'DINE_IN' | 'DIRECT';
    tableNumber?: number | null;
  }) {
    if (input.orderType === 'DIRECT' || input.tableNumber == null) {
      return 'direct order';
    }

    return `table ${input.tableNumber}`;
  }

  private async notifyUsersByRole(input: {
    tenantId: string;
    roles: RoleName[];
    type: AppNotificationType;
    title: string;
    message: string;
    payload?: NotificationPayload;
  }) {
    const users = await this.prisma.user.findMany({
      where: {
        tenantId: input.tenantId,
        status: 'ACTIVE',
        role: {
          is: {
            isActive: true,
            name: { in: input.roles },
          },
        },
      },
      select: {
        id: true,
      },
    });

    const notifications = await Promise.all(
      users.map((user) =>
        (this.prisma as any).notification.create({
          data: {
            tenantId: input.tenantId,
            userId: user.id,
            type: input.type as any,
            title: input.title,
            message: input.message,
            payload: input.payload,
          },
        }),
      ),
    );

    notifications.forEach((notification) => {
      this.gateway.emitToUser(notification.userId!, this.formatNotification(notification));
    });

    return notifications;
  }

  private async notifyAdmins(input: {
    tenantId?: string;
    type: AppNotificationType;
    title: string;
    message: string;
    payload?: NotificationPayload;
  }) {
    const admins = await this.prisma.admin.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });

    const notifications = await Promise.all(
      admins.map((admin) =>
        (this.prisma as any).notification.create({
          data: {
            tenantId: input.tenantId,
            adminId: admin.id,
            type: input.type as any,
            title: input.title,
            message: input.message,
            payload: input.payload,
          },
        }),
      ),
    );

    notifications.forEach((notification) => {
      this.gateway.emitToAdmin(
        notification.adminId!,
        this.formatNotification(notification),
      );
    });

    return notifications;
  }

  async notifyOrderSentToKitchen(input: {
    tenantId: string;
    orderId: string;
    tableId?: string | null;
    tableNumber?: number | null;
    orderType?: 'DINE_IN' | 'DIRECT';
  }) {
    const orderLabel = this.getOrderLabel(input);

    await this.notifyUsersByRole({
      tenantId: input.tenantId,
      roles: this.withLeadershipRoles([RoleName.KITCHEN]),
      type: 'ORDER_SENT_TO_KITCHEN',
      title: `New order for ${orderLabel}`,
      message: `A new order was sent to kitchen for ${orderLabel}.`,
      payload: {
        orderId: input.orderId,
        tableId: input.tableId,
        tableNumber: input.tableNumber,
        orderType: input.orderType,
      },
    });
  }

  async notifyOrderCancelled(input: {
    tenantId: string;
    orderId: string;
    tableId?: string | null;
    tableNumber?: number | null;
    orderType?: 'DINE_IN' | 'DIRECT';
  }) {
    const orderLabel = this.getOrderLabel(input);

    await Promise.all([
      this.notifyUsersByRole({
        tenantId: input.tenantId,
        roles: this.withLeadershipRoles([RoleName.KITCHEN]),
        type: 'ORDER_CANCELLED',
        title: `Order cancelled for ${orderLabel}`,
        message: `An order was cancelled for ${orderLabel}.`,
        payload: {
          orderId: input.orderId,
          tableId: input.tableId,
          tableNumber: input.tableNumber,
          orderType: input.orderType,
        },
      }),
      this.notifyAdmins({
        tenantId: input.tenantId,
        type: 'ORDER_CANCELLED',
        title: `Order cancelled for ${orderLabel}`,
        message: `A staff member cancelled an order for ${orderLabel}.`,
        payload: {
          orderId: input.orderId,
          tableId: input.tableId,
          tableNumber: input.tableNumber,
          orderType: input.orderType,
        },
      }),
    ]);
  }

  async notifyKitchenOrderReady(input: {
    tenantId: string;
    ticketId: string;
    ticketCode: string;
    orderId: string;
    tableId?: string | null;
    tableNumber?: number | null;
    orderType?: 'DINE_IN' | 'DIRECT';
  }) {
    const orderLabel = this.getOrderLabel(input);

    await Promise.all([
      this.notifyUsersByRole({
        tenantId: input.tenantId,
        roles: this.withLeadershipRoles([RoleName.CASHIER, RoleName.SERVER]),
        type: 'ORDER_READY',
        title: `Order ready for ${orderLabel}`,
        message: `Kitchen marked the order ready for ${orderLabel}.`,
        payload: {
          ticketId: input.ticketId,
          ticketCode: input.ticketCode,
          orderId: input.orderId,
          tableId: input.tableId,
          tableNumber: input.tableNumber,
          orderType: input.orderType,
        },
      }),
      this.notifyAdmins({
        tenantId: input.tenantId,
        type: 'ORDER_READY',
        title: `Kitchen completed order for ${orderLabel}`,
        message: `Kitchen marked the order ready for ${orderLabel}.`,
        payload: {
          ticketId: input.ticketId,
          ticketCode: input.ticketCode,
          orderId: input.orderId,
          tableId: input.tableId,
          tableNumber: input.tableNumber,
          orderType: input.orderType,
        },
      }),
    ]);
  }

  async notifyOrderArchived(input: {
    tenantId: string;
    ticketId: string;
    ticketCode: string;
    orderId: string;
    tableId?: string | null;
    tableNumber?: number | null;
    orderType?: 'DINE_IN' | 'DIRECT';
  }) {
    const orderLabel = this.getOrderLabel(input);

    await Promise.all([
      this.notifyUsersByRole({
        tenantId: input.tenantId,
        roles: this.withLeadershipRoles([RoleName.SERVER]),
        type: 'ORDER_ARCHIVED',
        title: `Order archived for ${orderLabel}`,
        message: `Order workflow was archived for ${orderLabel}.`,
        payload: {
          ticketId: input.ticketId,
          ticketCode: input.ticketCode,
          orderId: input.orderId,
          tableId: input.tableId,
          tableNumber: input.tableNumber,
          orderType: input.orderType,
        },
      }),
      this.notifyAdmins({
        tenantId: input.tenantId,
        type: 'ORDER_ARCHIVED',
        title: `Order archived for ${orderLabel}`,
        message: `A ticket was archived for ${orderLabel}.`,
        payload: {
          ticketId: input.ticketId,
          ticketCode: input.ticketCode,
          orderId: input.orderId,
          tableId: input.tableId,
          tableNumber: input.tableNumber,
          orderType: input.orderType,
        },
      }),
    ]);
  }

  async notifyCashierPaymentCompleted(input: {
    tenantId: string;
    tableId?: string | null;
    tableNumber?: number | null;
    orderId?: string;
    orderType?: 'DINE_IN' | 'DIRECT';
    paymentMethod: string;
    totalAmount: number;
    orderCount: number;
  }) {
    const orderLabel = this.getOrderLabel(input);

    await Promise.all([
      this.notifyUsersByRole({
        tenantId: input.tenantId,
        roles: this.withLeadershipRoles([]),
        type: 'PAYMENT_COMPLETED',
        title: `Payment completed for ${orderLabel}`,
        message: `Cashier completed payment for ${orderLabel} by ${input.paymentMethod}.`,
        payload: {
          orderId: input.orderId,
          orderType: input.orderType,
          tableId: input.tableId,
          tableNumber: input.tableNumber,
          paymentMethod: input.paymentMethod,
          totalAmount: input.totalAmount,
          orderCount: input.orderCount,
        },
      }),
      this.notifyAdmins({
        tenantId: input.tenantId,
        type: 'PAYMENT_COMPLETED',
        title: `Payment completed for ${orderLabel}`,
        message: `Cashier completed payment for ${orderLabel} by ${input.paymentMethod}.`,
        payload: {
          orderId: input.orderId,
          orderType: input.orderType,
          tableId: input.tableId,
          tableNumber: input.tableNumber,
          paymentMethod: input.paymentMethod,
          totalAmount: input.totalAmount,
          orderCount: input.orderCount,
        },
      }),
    ]);
  }

  async notifyTenantSubscriptionPaid(input: {
    tenantId: string;
    tenantName: string;
    provider: string;
    amount: number;
    currency: string;
    reference: string;
  }) {
    await Promise.all([
      this.notifyUsersByRole({
        tenantId: input.tenantId,
        roles: this.withLeadershipRoles([]),
        type: 'SUBSCRIPTION_PAID',
        title: `Tenant subscription paid: ${input.tenantName}`,
        message: `${input.tenantName} completed subscription payment via ${input.provider}.`,
        payload: {
          tenantId: input.tenantId,
          tenantName: input.tenantName,
          provider: input.provider,
          amount: input.amount,
          currency: input.currency,
          reference: input.reference,
        },
      }),
      this.notifyAdmins({
        tenantId: input.tenantId,
        type: 'SUBSCRIPTION_PAID',
        title: `Tenant subscription paid: ${input.tenantName}`,
        message: `${input.tenantName} completed subscription payment via ${input.provider}.`,
        payload: {
          tenantId: input.tenantId,
          tenantName: input.tenantName,
          provider: input.provider,
          amount: input.amount,
          currency: input.currency,
          reference: input.reference,
        },
      }),
    ]);
  }

  async notifyInventoryDeletionApprovalRequested(input: {
    tenantId: string;
    productId: string;
    productName: string;
    productSku?: string | null;
    requestedByUserId: string;
    requestedByName: string;
    requestId: string;
  }) {
    await this.notifyUsersByRole({
      tenantId: input.tenantId,
      roles: [RoleName.SUPERVISOR],
      type: 'GENERIC',
      title: `Inventory deletion approval needed`,
      message: `${input.requestedByName} requested deletion for ${input.productName}.`,
      payload: {
        requestId: input.requestId,
        productId: input.productId,
        productName: input.productName,
        productSku: input.productSku ?? null,
        requestedByUserId: input.requestedByUserId,
        requestedByName: input.requestedByName,
        action: 'INVENTORY_DELETION_APPROVAL_REQUESTED',
      },
    });
  }

  async list(actor: NotificationActor, dto: ListNotificationsDto) {
    const where = this.isAdmin(actor)
      ? { adminId: actor.sub, isRead: dto.isRead }
      : { userId: actor.sub, isRead: dto.isRead };

    const [notifications, total, unread] = await Promise.all([
      (this.prisma as any).notification.findMany({
        where,
        skip: (dto.page - 1) * dto.limit,
        take: dto.limit,
        orderBy: { createdAt: 'desc' },
      }),
      (this.prisma as any).notification.count({ where }),
      (this.prisma as any).notification.count({
        where: this.isAdmin(actor)
          ? { adminId: actor.sub, isRead: false }
          : { userId: actor.sub, isRead: false },
      }),
    ]);

    const response = buildPaginatedResponse(
      notifications.map((notification) => this.formatNotification(notification)),
      dto.page,
      dto.limit,
      total,
    ) as any;

    response.meta.unreadCount = unread;
    return response;
  }

  async getUnreadCount(actor: NotificationActor) {
    const unreadCount = await (this.prisma as any).notification.count({
      where: this.isAdmin(actor)
        ? { adminId: actor.sub, isRead: false }
        : { userId: actor.sub, isRead: false },
    });

    return { unreadCount };
  }

  async markRead(actor: NotificationActor, id: string) {
    const notification = await (this.prisma as any).notification.findFirst({
      where: this.isAdmin(actor)
        ? { id, adminId: actor.sub }
        : { id, userId: actor.sub },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    const updated = await (this.prisma as any).notification.update({
      where: { id },
      data: { isRead: true },
    });

    this.gateway.emitNotificationRead(actor.sub, { id: updated.id });
    return this.formatNotification(updated);
  }

  async markAllRead(actor: NotificationActor) {
    const where = this.isAdmin(actor)
      ? { adminId: actor.sub, isRead: false }
      : { userId: actor.sub, isRead: false };

    const result = await (this.prisma as any).notification.updateMany({
      where,
      data: { isRead: true },
    });

    this.gateway.emitNotificationReadAll(actor.sub);
    return { count: result.count };
  }
}
