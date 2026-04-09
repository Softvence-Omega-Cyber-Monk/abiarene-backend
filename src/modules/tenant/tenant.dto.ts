import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto.js';

export class CreateTenantDto {
  @ApiProperty({ description: 'Tenant name' })
  @IsString()
  name!: string;

  @ApiPropertyOptional({ description: 'Tenant industry', example: 'restaurant' })
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiPropertyOptional({ description: 'Subscription fee', example: 99.99 })
  @IsOptional()
  @IsNumber()
  subscriptionFee?: number;
}

export class UpdateTenantDto extends PartialType(CreateTenantDto) {}

export class ListTenantDto extends PaginationDto {}
