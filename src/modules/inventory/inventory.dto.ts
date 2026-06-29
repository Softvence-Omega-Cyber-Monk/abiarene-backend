import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto.js';

export class CreateInventoryDto {
  @ApiProperty({ description: 'Product name' })
  @IsString()
  name!: string;

  @ApiProperty({ description: 'Unit price', example: 12.5 })
  @Type(() => Number)
  @IsNumber()
  price!: number;

  @ApiPropertyOptional({ description: 'Stock keeping unit' })
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiPropertyOptional({ description: 'Barcode' })
  @IsOptional()
  @IsString()
  barcode?: string;

  @ApiPropertyOptional({ description: 'Current stock quantity', example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  stock?: number;

  @ApiPropertyOptional({ description: 'Low stock threshold', example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  lowStockThreshold?: number;
}

export class UpdateInventoryDto extends PartialType(CreateInventoryDto) {}

export class ListInventoryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Search inventory by product name or barcode',
    example: 'coke',
  })
  @IsOptional()
  @IsString()
  search?: string;
}

export class ListInventoryDeletionRequestsDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filter deletion requests by status',
    enum: ['PENDING', 'APPROVED', 'REJECTED'],
    example: 'PENDING',
  })
  @IsOptional()
  @IsIn(['PENDING', 'APPROVED', 'REJECTED'])
  status?: 'PENDING' | 'APPROVED' | 'REJECTED';
}

export class RejectInventoryDeletionRequestDto {
  @ApiPropertyOptional({
    description: 'Optional rejection reason for supervisor audit context',
    example: 'Item should remain until month-end stock count is complete.',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
