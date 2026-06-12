import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { AdminTablesController } from './controllers/admin-tables.controller.js';
import { TenantTablesController } from './controllers/tenant-tables.controller.js';
import { AdminTablesService } from './services/admin-tables.service.js';
import { TenantTablesService } from './services/tenant-tables.service.js';

@Module({
  imports: [NotificationsModule],
  controllers: [AdminTablesController, TenantTablesController],
  providers: [AdminTablesService, TenantTablesService],
  exports: [AdminTablesService, TenantTablesService],
})
export class TablesModule {}
