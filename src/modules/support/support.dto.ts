import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto.js';

export class CreateSupportDto {
  @ApiProperty({ description: 'Support subject' })
  @IsString()
  subject!: string;

  @ApiProperty({ description: 'Support message' })
  @IsString()
  message!: string;
}

export class UpdateSupportDto extends PartialType(CreateSupportDto) {
  @ApiPropertyOptional({ description: 'Support response message' })
  @IsOptional()
  @IsString()
  response?: string;

  @ApiPropertyOptional({ enum: ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'] })
  @IsOptional()
  @IsIn(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'])
  status?: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
}

export class ListSupportDto extends PaginationDto {}
