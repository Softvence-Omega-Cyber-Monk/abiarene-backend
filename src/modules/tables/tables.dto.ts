import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { TableStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { ArrayUnique, IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto.js';

export class CreateTablesDto {
  @ApiProperty({ description: 'Table number', example: 12 })
  @Type(() => Number)
  @IsInt()
  tableNumber!: number;

  @ApiPropertyOptional({ description: 'Seat count', example: 4 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  seatCount?: number;

  @ApiPropertyOptional({
    enum: TableStatus,
    enumName: 'TableStatus',
    description: 'Table status. Available options: AVAILABLE, OCCUPIED',
    example: TableStatus.AVAILABLE,
  })
  @IsOptional()
  @IsEnum(TableStatus)
  status?: TableStatus;

  @ApiPropertyOptional({
    description: 'Whether the table has been served',
    example: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  served?: boolean;
}

export class UpdateTablesDto extends PartialType(CreateTablesDto) {}

export class ListTablesDto extends PaginationDto {}

export class SetTableItemsDto {
  @ApiProperty({ description: 'Shared menu name for this tenant', example: 'Main Menu' })
  @IsString()
  name!: string;

  @ApiProperty({ type: [String], description: 'Tenant item IDs assigned to the shared menu' })
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  itemIds!: string[];
}

export class CashierCheckoutDto {
  @ApiProperty({
    enum: ['CASH', 'CARD'],
    description: 'How the table bill was paid',
    example: 'CASH',
  })
  @IsIn(['CASH', 'CARD'])
  method!: 'CASH' | 'CARD';

  @ApiPropertyOptional({
    description: 'Optional discount ID to apply during checkout',
    example: 'discount-id',
  })
  @IsOptional()
  @IsString()
  discountId?: string;
}
