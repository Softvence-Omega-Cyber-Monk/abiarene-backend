import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto.js';

export const SUPPORT_ISSUE_TYPES = [
  'Sync Issue',
  'Hardware/Printer Error',
  'Inventory/Barcode Error',
  'Payment Failure',
] as const;

export class CreateSupportDto {
  @ApiProperty({
    description: 'Support issue type',
    enum: SUPPORT_ISSUE_TYPES,
    example: 'Hardware/Printer Error',
  })
  @IsIn(SUPPORT_ISSUE_TYPES)
  issueType!: (typeof SUPPORT_ISSUE_TYPES)[number];

  @ApiProperty({
    description: 'Support issue description',
    example: 'Thermal printer is not printing kitchen tickets.',
  })
  @IsString()
  @MinLength(3)
  description!: string;
}

export class CreateSupportMessageDto {
  @ApiProperty({
    description: 'Conversation message for this support issue',
    example: 'Please share a photo of the printer settings screen.',
  })
  @IsString()
  @MinLength(1)
  message!: string;
}

export class UpdateSupportStatusDto {
  @ApiProperty({
    description: 'Support ticket status',
    enum: ['OPEN', 'CLOSED'],
    example: 'CLOSED',
  })
  @IsIn(['OPEN', 'CLOSED'])
  status!: 'OPEN' | 'CLOSED';
}

export class ListSupportDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ['OPEN', 'CLOSED'] })
  @IsOptional()
  @IsIn(['OPEN', 'CLOSED'])
  status?: 'OPEN' | 'CLOSED';

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}
