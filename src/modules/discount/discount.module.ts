import { Module } from '@nestjs/common';
import { DiscountController } from './discount.controller.js';
import { DiscountService } from './discount.service.js';

@Module({
  controllers: [DiscountController],
  providers: [DiscountService],
  exports: [DiscountService],
})
export class DiscountModule {}
