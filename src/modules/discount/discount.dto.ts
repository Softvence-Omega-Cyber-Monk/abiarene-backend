import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto.js';

export class CreateDiscountDto {
  @ApiProperty({ description: 'Order ID' })
  @IsString()
  orderId!: string;

  @ApiProperty({ description: 'Requested discount amount', example: 5.5 })
  @Type(() => Number)
  @IsNumber()
  amount!: number;

  @ApiPropertyOptional({ description: 'Reason for discount request' })
  @IsOptional()
  @IsString()
  reason?: string;
}

export class UpdateDiscountDto extends PartialType(CreateDiscountDto) {
  @ApiPropertyOptional({ enum: ['PENDING', 'APPROVED', 'REJECTED'] })
  @IsOptional()
  @IsIn(['PENDING', 'APPROVED', 'REJECTED'])
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export class ListDiscountDto extends PaginationDto {}
