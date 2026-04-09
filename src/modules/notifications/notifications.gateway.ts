import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({ namespace: 'notifications', cors: true })
export class NotificationsGateway {
  @WebSocketServer()
  server!: Server;

  broadcastKitchenReady(payload: { tenantId: string; ticketId: string }) {
    this.server.emit('kitchen-ready', payload);
  }

  broadcastTableUpdate(payload: { tenantId: string; tableId: string; status: string }) {
    this.server.emit('table-update', payload);
  }
}
