import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Socket, Server } from 'socket.io';
import { RoleName } from '../../common/constants/role-name.js';
import { PrismaService } from '../../prisma/prisma.service.js';

@WebSocketGateway({ namespace: 'notifications', cors: true })
export class NotificationsGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  private extractToken(client: Socket) {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.trim()) {
      return authToken.replace(/^Bearer\s+/i, '');
    }

    const header = client.handshake.headers.authorization;
    if (typeof header === 'string' && header.trim()) {
      return header.replace(/^Bearer\s+/i, '');
    }

    const queryToken = client.handshake.query?.token;
    if (typeof queryToken === 'string' && queryToken.trim()) {
      return queryToken.replace(/^Bearer\s+/i, '');
    }

    return null;
  }

  async handleConnection(client: Socket) {
    try {
      const token = this.extractToken(client);
      if (!token) {
        client.disconnect();
        return;
      }

      const payload = await this.jwtService.verifyAsync<{
        sub: string;
        role: string;
        tenantId?: string;
        tokenVersion?: number;
      }>(token, {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
      });

      if (payload.role?.toUpperCase() === RoleName.ADMIN) {
        const admin = await this.prisma.admin.findFirst({
          where: { id: payload.sub, status: 'ACTIVE' },
          select: { id: true, tokenVersion: true },
        });

        if (!admin || (payload.tokenVersion ?? 0) !== admin.tokenVersion) {
          client.disconnect();
          return;
        }
      } else {
        const user = await this.prisma.user.findFirst({
          where: {
            id: payload.sub,
            tenantId: payload.tenantId,
            status: 'ACTIVE',
          },
          select: { id: true, tokenVersion: true },
        });

        if (!user || (payload.tokenVersion ?? 0) !== user.tokenVersion) {
          client.disconnect();
          return;
        }
      }

      client.data.user = payload;
      client.join(`user:${payload.sub}`);

      if (payload.role?.toUpperCase() === RoleName.ADMIN) {
        client.join('admins');
        client.join(`admin:${payload.sub}`);
        return;
      }

      if (payload.tenantId) {
        client.join(`tenant:${payload.tenantId}`);
        client.join(`tenant:${payload.tenantId}:role:${payload.role}`);
      }
    } catch {
      client.disconnect();
    }
  }

  @SubscribeMessage('notifications:ping')
  handlePing(@ConnectedSocket() client: Socket, @MessageBody() body?: unknown) {
    client.emit('notifications:pong', body ?? { ok: true });
  }

  emitToUser(userId: string, notification: unknown) {
    this.server.to(`user:${userId}`).emit('notification:new', notification);
  }

  emitToAdmin(adminId: string, notification: unknown) {
    this.server.to(`admin:${adminId}`).emit('notification:new', notification);
  }

  emitNotificationRead(actorId: string, payload: { id: string }) {
    this.server.to(`user:${actorId}`).emit('notification:read', payload);
    this.server.to(`admin:${actorId}`).emit('notification:read', payload);
  }

  emitNotificationReadAll(actorId: string) {
    this.server.to(`user:${actorId}`).emit('notification:read-all', {
      ok: true,
    });
    this.server.to(`admin:${actorId}`).emit('notification:read-all', {
      ok: true,
    });
  }
}
