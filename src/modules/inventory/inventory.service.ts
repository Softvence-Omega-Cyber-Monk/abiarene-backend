import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import {
  CreateInventoryDto,
  ListInventoryDeletionRequestsDto,
  ListInventoryDto,
  UpdateInventoryDto,
} from './inventory.dto.js';
import { buildPaginatedResponse } from '../../common/utils/pagination.js';
import { AuthUser } from '../../common/interfaces/auth-user.interface.js';
import { NotificationsService } from '../notifications/notifications.service.js';

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  private async attachDeletionRequestState<
    T extends { id: string } | { id: string }[]
  >(tenantId: string, input: T): Promise<T> {
    const items = Array.isArray(input) ? input : [input];

    if (items.length === 0) {
      return input;
    }

    const pendingRequests = await this.prisma.inventoryDeletionRequest.findMany({
      where: {
        tenantId,
        productId: { in: items.map((item) => item.id) },
        status: 'PENDING',
      },
      select: {
        id: true,
        productId: true,
        status: true,
      },
    });

    const requestByProductId = new Map(
      pendingRequests.map((request) => [request.productId, request]),
    );

    const withState = items.map((item) => {
      const pendingRequest = requestByProductId.get(item.id);

      return {
        ...item,
        deleteRequestStatus: pendingRequest?.status ?? null,
        deleteRequestId: pendingRequest?.id ?? null,
      };
    });

    return (Array.isArray(input) ? withState : withState[0]) as T;
  }

  create(tenantId: string, dto: CreateInventoryDto) {
    return this.prisma.product.create({ data: { ...dto, tenantId } as any });
  }

  async list(tenantId: string, dto: ListInventoryDto) {
    const where = { tenantId } as any;
    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip: (dto.page - 1) * dto.limit,
        take: dto.limit,
        orderBy: { createdAt: 'desc' } as any,
      }),
      this.prisma.product.count({ where }),
    ]);

    const productsWithState = await this.attachDeletionRequestState(
      tenantId,
      products,
    );

    return buildPaginatedResponse(productsWithState, dto.page, dto.limit, total);
  }

  async stockAlerts(tenantId: string) {
    const products = await this.prisma.product.findMany({
      where: { tenantId } as any,
      orderBy: [{ stock: 'asc' }, { updatedAt: 'desc' }] as any,
    });

    const productsWithState = await this.attachDeletionRequestState(
      tenantId,
      products,
    );

    const lowStockProducts = productsWithState.filter(
      (product) => product.stock <= product.lowStockThreshold,
    );

    return {
      data: lowStockProducts.map((product) => ({
        ...product,
        shortage: product.lowStockThreshold - product.stock,
      })),
      meta: {
        count: lowStockProducts.length,
      },
    };
  }

  read(tenantId: string, id: string) {
    return this.prisma.product
      .findFirst({ where: { tenantId, id } as any })
      .then((product) =>
        product ? this.attachDeletionRequestState(tenantId, product) : product,
      );
  }

  async readByInventory(tenantId: string, inventory: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        tenantId,
        OR: [{ name: inventory }, { sku: inventory }, { barcode: inventory }],
      } as any,
    });

    if (!product) {
      throw new NotFoundException('Product not found in inventory');
    }

    return this.attachDeletionRequestState(tenantId, product);
  }

  async update(tenantId: string, id: string, dto: UpdateInventoryDto) {
    await this.prisma.product.updateMany({
      where: { tenantId, id } as any,
      data: dto as any,
    });
    return this.read(tenantId, id);
  }

  async delete(
    tenantId: string,
    id: string,
    actor: AuthUser & { sub: string; role: string },
  ) {
    const product = await this.prisma.product.findFirst({
      where: { tenantId, id } as any,
    });

    if (!product) {
      throw new NotFoundException('Inventory item not found');
    }

    const actorRole = actor.role.toUpperCase();
    if (actorRole === 'SUPERVISOR') {
      const { deletedProduct, clearedRequests } = await this.prisma.$transaction(
        async (tx) => {
          const deletedProduct = await tx.product.deleteMany({
            where: { tenantId, id } as any,
          });

          const clearedRequests = await tx.inventoryDeletionRequest.deleteMany({
            where: {
              tenantId,
              productId: product.id,
              status: 'PENDING',
            },
          });

          return { deletedProduct, clearedRequests };
        },
      );

      return {
        mode: 'DELETED_DIRECTLY',
        count: deletedProduct.count,
        clearedPendingRequests: clearedRequests.count,
        inventory: product,
      };
    }

    if (actorRole !== 'MANAGER') {
      throw new ForbiddenException(
        'Only supervisor can delete directly. Manager requires supervisor approval.',
      );
    }

    const existingPendingRequest =
      await this.prisma.inventoryDeletionRequest.findFirst({
        where: {
          tenantId,
          productId: product.id,
          status: 'PENDING',
        },
      });

    if (existingPendingRequest) {
      throw new BadRequestException(
        'A supervisor approval request is already pending for this inventory item',
      );
    }

    const request = await this.prisma.inventoryDeletionRequest.create({
      data: {
        tenantId,
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        requestedByUserId: actor.sub,
      },
      include: {
        requestedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    await this.notifications.notifyInventoryDeletionApprovalRequested({
      tenantId,
      requestId: request.id,
      productId: product.id,
      productName: product.name,
      productSku: product.sku,
      requestedByUserId: actor.sub,
      requestedByName: request.requestedBy.name,
    });

    return {
      mode: 'APPROVAL_REQUESTED',
      message: 'Supervisor approval is required before this inventory item can be deleted.',
      request: {
        id: request.id,
        status: request.status,
        requestedAt: request.createdAt,
        inventory: {
          id: product.id,
          name: product.name,
          sku: product.sku,
          barcode: product.barcode,
        },
      },
    };
  }

  async listDeletionRequests(
    tenantId: string,
    dto: ListInventoryDeletionRequestsDto,
  ) {
    const where = {
      tenantId,
      status: dto.status,
    } as const;

    const [requests, total] = await Promise.all([
      this.prisma.inventoryDeletionRequest.findMany({
        where,
        skip: (dto.page - 1) * dto.limit,
        take: dto.limit,
        include: {
          requestedBy: {
            select: { id: true, name: true, email: true },
          },
          approvedBy: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.inventoryDeletionRequest.count({ where }),
    ]);

    return buildPaginatedResponse(requests, dto.page, dto.limit, total);
  }

  async approveDeletionRequest(
    tenantId: string,
    requestId: string,
    approverUserId: string,
  ) {
    const request = await this.prisma.inventoryDeletionRequest.findFirst({
      where: {
        id: requestId,
        tenantId,
        status: 'PENDING',
      },
    });

    if (!request) {
      throw new NotFoundException('Pending inventory deletion request not found');
    }

    const deleted = await this.prisma.$transaction(async (tx) => {
      const result = await tx.product.deleteMany({
        where: {
          id: request.productId,
          tenantId,
        } as any,
      });

      if (result.count === 0) {
        throw new NotFoundException('Inventory item no longer exists');
      }

      return tx.inventoryDeletionRequest.update({
        where: { id: request.id },
        data: {
          status: 'APPROVED',
          approvedByUserId: approverUserId,
        },
        include: {
          requestedBy: {
            select: { id: true, name: true, email: true },
          },
          approvedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      });
    });

    return {
      message: 'Inventory deletion request approved and item deleted.',
      request: deleted,
    };
  }

  async rejectDeletionRequest(
    tenantId: string,
    requestId: string,
    approverUserId: string,
    reason?: string,
  ) {
    const request = await this.prisma.inventoryDeletionRequest.findFirst({
      where: {
        id: requestId,
        tenantId,
        status: 'PENDING',
      },
    });

    if (!request) {
      throw new NotFoundException('Pending inventory deletion request not found');
    }

    const rejected = await this.prisma.inventoryDeletionRequest.update({
      where: { id: request.id },
      data: {
        status: 'REJECTED',
        approvedByUserId: approverUserId,
      },
      include: {
        requestedBy: {
          select: { id: true, name: true, email: true },
        },
        approvedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return {
      message: 'Inventory deletion request rejected.',
      reason: reason ?? null,
      request: rejected,
    };
  }
}
