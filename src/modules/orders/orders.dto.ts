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

export class UpdateOrdersDto extends PartialType(CreateOrdersDto) {
  @ApiPropertyOptional({ enum: ['PENDING', 'IN_KITCHEN', 'READY', 'COMPLETED', 'CANCELLED'] })
  @IsOptional()
  @IsIn(['PENDING', 'IN_KITCHEN', 'READY', 'COMPLETED', 'CANCELLED'])
  status?: 'PENDING' | 'IN_KITCHEN' | 'READY' | 'COMPLETED' | 'CANCELLED';
}

export class ListOrdersDto extends PaginationDto {}
