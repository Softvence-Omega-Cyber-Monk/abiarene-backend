import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';
import { TenantGuard } from './common/guards/tenant.guard.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { DevicesModule } from './modules/devices/devices.module.js';
import { DiscountModule } from './modules/discount/discount.module.js';
import { InventoryModule } from './modules/inventory/inventory.module.js';
import { MenuModule } from './modules/menu/menu.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { OrdersModule } from './modules/orders/orders.module.js';
import { PaymentsModule } from './modules/payments/payments.module.js';
import { RolesModule } from './modules/roles/roles.module.js';
import { SupportModule } from './modules/support/support.module.js';
import { TablesModule } from './modules/tables/tables.module.js';
import { TenantModule } from './modules/tenant/tenant.module.js';
import { TicketsModule } from './modules/tickets/tickets.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    RolesModule,
    TenantModule,
    InventoryModule,
    MenuModule,
    TablesModule,
    OrdersModule,
    TicketsModule,
    PaymentsModule,
    DiscountModule,
    DevicesModule,
    NotificationsModule,
    SupportModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
