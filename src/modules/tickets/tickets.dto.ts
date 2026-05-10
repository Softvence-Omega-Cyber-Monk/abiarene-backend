import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto.js';

export class ListTicketsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ['PREPARING', 'READY', 'COMPLETED'] })
  @IsOptional()
  @IsIn(['PREPARING', 'READY', 'COMPLETED'])
  status?: 'PREPARING' | 'READY' | 'COMPLETED';
}
