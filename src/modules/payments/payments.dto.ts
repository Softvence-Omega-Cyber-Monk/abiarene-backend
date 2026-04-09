import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsNumber, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto.js';

export class CreatePaymentsDto {
  @ApiProperty({ description: 'Order ID' })
  @IsString()
  orderId!: string;

  @ApiProperty({ description: 'Payment amount', example: 45.5 })
  @Type(() => Number)
  @IsNumber()
  amount!: number;

  @ApiPropertyOptional({ enum: PaymentMethod })
  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;
}

export class UpdatePaymentsDto extends PartialType(CreatePaymentsDto) {
  @ApiPropertyOptional({ enum: ['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'] })
  @IsOptional()
  @IsIn(['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'])
  status?: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
}

export class ListPaymentsDto extends PaginationDto {}
