import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto.js';

export class ListTicketsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ['ACTIVE', 'READY', 'ARCHIVED'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'READY', 'ARCHIVED'])
  status?: 'ACTIVE' | 'READY' | 'ARCHIVED';
}
