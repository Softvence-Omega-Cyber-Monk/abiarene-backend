import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { buildPaginatedResponse } from '../../common/utils/pagination.js';
import { AuthUser } from '../../common/interfaces/auth-user.interface.js';
import {
  CreateSupportDto,
  CreateSupportMessageDto,
  ListSupportDto,
  UpdateSupportStatusDto,
} from './support.dto.js';

@Injectable()
export class SupportService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly supportInclude = {
    tenant: {
      select: {
        id: true,
        name: true,
      },
    },
    messages: {
      orderBy: {
        createdAt: 'asc' as const,
      },
    },
  };

  private formatIssue(
    ticket: {
      id: string;
      tenantId: string;
      subject: string;
      message: string;
      status: 'OPEN' | 'CLOSED';
      response: string | null;
      createdAt: Date;
      updatedAt: Date;
      tenant?: { id: string; name: string } | null;
      messages?: {
        id: string;
        ticketId: string;
        senderRole: 'ADMIN' | 'MANAGER';
        senderName: string;
        senderEmail: string;
        message: string;
        createdAt: Date;
      }[];
    } | null,
  ) {
    if (!ticket) {
      return null;
    }

    const { subject, message, ...rest } = ticket;

    return {
      ...rest,
      issueType: subject,
      description: message,
    };
  }

  private managerWhere(user: AuthUser) {
    if (!user.tenantId) {
      throw new ForbiddenException('Missing tenant context');
    }

    return { tenantId: user.tenantId };
  }

  private messageSender(user: AuthUser) {
    if (user.role === 'admin') {
      return {
        senderRole: 'ADMIN' as const,
        senderName: user.name ?? 'Admin',
        senderEmail: user.email ?? 'admin',
      };
    }

    return {
      senderRole: 'MANAGER' as const,
      senderName: user.name ?? 'Manager',
      senderEmail: user.email ?? 'manager',
    };
  }

  async create(user: AuthUser, dto: CreateSupportDto) {
    const where = this.managerWhere(user);

    const ticket = await this.prisma.supportTicket.create({
      data: {
        tenantId: where.tenantId,
        subject: dto.issueType,
        message: dto.description,
        status: 'OPEN',
        messages: {
          create: {
            ...this.messageSender(user),
            message: dto.description,
          },
        },
      } as any,
      include: this.supportInclude,
    });

    return this.formatIssue(ticket);
  }

  async list(user: AuthUser, dto: ListSupportDto) {
    const where =
      user.role === 'admin'
        ? { status: dto.status }
        : { ...this.managerWhere(user), status: dto.status };

    const [tickets, total] = await Promise.all([
      this.prisma.supportTicket.findMany({
        where: where as any,
        skip: (dto.page - 1) * dto.limit,
        take: dto.limit,
        include: this.supportInclude,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.supportTicket.count({ where: where as any }),
    ]);

    return buildPaginatedResponse(
      tickets.map((ticket) => this.formatIssue(ticket)),
      dto.page,
      dto.limit,
      total,
    );
  }

  async read(user: AuthUser, id: string) {
    const where =
      user.role === 'admin'
        ? { id }
        : { id, ...this.managerWhere(user) };

    const ticket = await this.prisma.supportTicket.findFirst({
      where: where as any,
      include: this.supportInclude,
    });

    if (!ticket) {
      throw new NotFoundException('Support issue not found');
    }

    return this.formatIssue(ticket);
  }

  async addMessage(user: AuthUser, id: string, dto: CreateSupportMessageDto) {
    const where =
      user.role === 'admin'
        ? { id }
        : { id, ...this.managerWhere(user) };

    const ticket = await this.prisma.supportTicket.findFirst({
      where: where as any,
      select: { id: true, status: true },
    });

    if (!ticket) {
      throw new NotFoundException('Support issue not found');
    }

    if (ticket.status === 'CLOSED') {
      throw new BadRequestException('This support issue is closed. Conversation is disabled.');
    }

    await this.prisma.supportTicketMessage.create({
      data: {
        ticketId: ticket.id,
        ...this.messageSender(user),
        message: dto.message,
      } as any,
    });

    return this.read(user, id);
  }

  async updateStatus(
    user: AuthUser,
    id: string,
    dto: UpdateSupportStatusDto,
  ) {
    if (user.role !== 'admin') {
      throw new ForbiddenException('This route is for admin only');
    }

    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id },
      select: { id: true },
    });

    if (!ticket) {
      throw new NotFoundException('Support issue not found');
    }

    await this.prisma.supportTicket.update({
      where: { id },
      data: { status: dto.status },
    });

    return this.read(user, id);
  }
}
