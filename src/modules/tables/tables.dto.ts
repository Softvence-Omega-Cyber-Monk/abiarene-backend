import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { TableStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { ArrayUnique, IsArray, IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
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
    description: 'Table status. Available options: AVAILABLE, OCCUPIED, SERVED',
    example: TableStatus.AVAILABLE,
  })
  @IsOptional()
  @IsEnum(TableStatus)
  status?: TableStatus;
}

export class UpdateTablesDto extends PartialType(CreateTablesDto) {}

export class ListTablesDto extends PaginationDto {}

export class SetTableItemsDto {
  @ApiProperty({ type: [String], description: 'Tenant item IDs assigned to this table' })
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  itemIds!: string[];
}
