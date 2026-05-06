import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  Matches,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto.js';

export class CreateTenantDto {
  @ApiProperty({ description: 'Tenant name' })
  @IsString()
  @MinLength(3)
  name!: string;

  @ApiPropertyOptional({ description: 'Tenant industry', example: 'restaurant' })
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiPropertyOptional({ description: 'Subscription fee', example: 99.99 })
  @IsOptional()
  @IsNumber()
  subscriptionFee?: number;

  @ApiProperty({
    description: 'Default manager email for this tenant',
    example: 'manager@example.com',
  })
  @IsEmail()
  managerEmail!: string;

  @ApiProperty({
    description: 'Default manager 4-digit PIN for this tenant',
    example: '1234',
    pattern: '^\\d{4}$',
  })
  @IsString()
  @Matches(/^\d{4}$/, { message: 'PIN must be exactly 4 digits' })
  managerPin!: string;

  @ApiPropertyOptional({
    description: 'Create the server role for this tenant',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  server?: boolean;

  @ApiPropertyOptional({
    description: 'Create the kitchen role for this tenant',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  kitchen?: boolean;

  @ApiPropertyOptional({
    description: 'Create the cashier role for this tenant',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  cashier?: boolean;
}

export class UpdateTenantDto {
  @ApiPropertyOptional({ description: 'Tenant name' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  name?: string;

  @ApiPropertyOptional({ description: 'Tenant industry', example: 'restaurant' })
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiPropertyOptional({ description: 'Subscription fee', example: 99.99 })
  @IsOptional()
  @IsNumber()
  subscriptionFee?: number;
}

export class ListTenantDto extends PaginationDto {}

export class ListTenantRolesDto {
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

export class UpdateTenantRolesDto {
  @ApiPropertyOptional({
    description: 'Enable the server role for this tenant',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  server?: boolean;

  @ApiPropertyOptional({
    description: 'Enable the kitchen role for this tenant',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  kitchen?: boolean;

  @ApiPropertyOptional({
    description: 'Enable the cashier role for this tenant',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  cashier?: boolean;
}
