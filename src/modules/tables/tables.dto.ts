import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional } from 'class-validator';
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

  @ApiPropertyOptional({ enum: ['AVAILABLE', 'OCCUPIED', 'SERVED'] })
  @IsOptional()
  @IsIn(['AVAILABLE', 'OCCUPIED', 'SERVED'])
  status?: 'AVAILABLE' | 'OCCUPIED' | 'SERVED';
}

export class UpdateTablesDto extends PartialType(CreateTablesDto) {}

export class ListTablesDto extends PaginationDto {}
