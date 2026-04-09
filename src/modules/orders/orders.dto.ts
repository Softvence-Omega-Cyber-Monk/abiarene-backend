import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto.js';

export class CreateOrdersDto {
  @ApiProperty({ description: 'Table ID' })
  @IsString()
  tableId!: string;
}

export class OrderItemDto {
  @ApiProperty({ description: 'Menu item ID' })
  @IsString()
  menuItemId!: string;

  @ApiProperty({ description: 'Quantity', example: 2 })
  @Type(() => Number)
  @IsInt()
  quantity!: number;

  @ApiPropertyOptional({ description: 'Optional notes for kitchen' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class AddOrderItemsDto {
  @ApiProperty({ type: [OrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];
}

export class UpdateOrdersDto extends PartialType(CreateOrdersDto) {}

export class ListOrdersDto extends PaginationDto {}
