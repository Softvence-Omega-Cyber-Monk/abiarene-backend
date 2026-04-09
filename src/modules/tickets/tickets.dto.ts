import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto.js';

export class CreateTicketsDto {
  @ApiProperty({ description: 'Order ID' })
  @IsString()
  orderId!: string;

  @ApiPropertyOptional({ enum: ['ACTIVE', 'READY', 'ARCHIVED'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'READY', 'ARCHIVED'])
  status?: 'ACTIVE' | 'READY' | 'ARCHIVED';
}

export class UpdateTicketsDto extends PartialType(CreateTicketsDto) {}
export class ListTicketsDto extends PaginationDto {}
