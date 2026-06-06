import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, ArrayUnique, IsArray, IsIn, IsInt, IsOptional, IsString, ValidateNested } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto.js';

export class OrderItemDto {
  @ApiProperty({ description: 'Item ID' })
  @IsString()
  itemId!: string;

  @ApiProperty({ description: 'Quantity', example: 2 })
  @Type(() => Number)
  @IsInt()
  quantity!: number;

  @ApiPropertyOptional({ description: 'Optional notes for kitchen' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Selected item options for this order line',
    example: ['Extra spicy', 'No Onion'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayUnique()
  selectedOptions?: string[];
}

export class CreateOrdersDto {
  @ApiProperty({ description: 'Table ID' })
  @IsString()
  tableId!: string;

  @ApiProperty({ type: [OrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];
}

export class CreateCashierDirectOrderDto {
  @ApiProperty({ type: [OrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];
}

export class InventoryOrderItemDto {
  @ApiProperty({ description: 'Inventory product ID' })
  @IsString()
  productId!: string;

  @ApiProperty({ description: 'Quantity', example: 2 })
  @Type(() => Number)
  @IsInt()
  quantity!: number;

  @ApiPropertyOptional({ description: 'Optional notes for this inventory line item' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateCashierInventoryOrderDto {
  @ApiProperty({ type: [InventoryOrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => InventoryOrderItemDto)
  items!: InventoryOrderItemDto[];
}

export class DirectOrderCheckoutDto {
  @ApiProperty({
    enum: ['CASH', 'CARD'],
    description: 'How the direct order bill was paid',
    example: 'CASH',
  })
  @IsIn(['CASH', 'CARD'])
  method!: 'CASH' | 'CARD';

  @ApiPropertyOptional({
    description: 'Optional discount ID to apply during direct checkout',
    example: 'discount-id',
  })
  @IsOptional()
  @IsString()
  discountId?: string;
}

export class UpdateOrdersDto extends PartialType(CreateOrdersDto) {
  @ApiPropertyOptional({ enum: ['CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'] })
  @IsOptional()
  @IsIn(['CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'])
  status?: 'CONFIRMED' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED';
}

export class ListOrdersDto extends PaginationDto {}
