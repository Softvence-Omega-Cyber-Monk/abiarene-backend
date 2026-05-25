import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto.js';

export const STRIPE_SUPPORTED_CURRENCIES = [
  'USD',
  'EUR',
  'GBP',
  'AUD',
  'CAD',
  'BDT',
  'SGD',
  'INR',
  'NGN',
  'KES',
  'ZAR',
  'AED',
  'SAR',
  'JPY',
  'CHF',
] as const;

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

  @ApiPropertyOptional({
    description: 'Create the manager role for this tenant',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  manager?: boolean;

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
    description: 'Enable the manager role for this tenant',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  manager?: boolean;

  @ApiPropertyOptional({
    description: 'Enable the supervisor role for this tenant',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  supervisor?: boolean;

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

export class UpdateTenantStatusDto {
  @ApiProperty({
    description: 'Tenant status for admin update',
    enum: ['ACTIVE', 'INACTIVE'],
    example: 'INACTIVE',
  })
  @IsIn(['ACTIVE', 'INACTIVE'])
  status!: 'ACTIVE' | 'INACTIVE';
}

export class InitiateSubscriptionPaymentDto {
  @ApiProperty({
    description: 'Selected online payment provider for tenant subscription payment',
    enum: ['stripe', 'orange', 'mtnMomo', 'paystack', 'godaddyPayments'],
    example: 'stripe',
  })
  @IsIn(['stripe', 'orange', 'mtnMomo', 'paystack', 'godaddyPayments'])
  provider!: 'stripe' | 'orange' | 'mtnMomo' | 'paystack' | 'godaddyPayments';

  @ApiPropertyOptional({
    description:
      'Payer mobile number required for MTN MoMo request-to-pay, e.g. 46733123450',
    example: '46733123450',
  })
  @IsOptional()
  @IsString()
  payerPhoneNumber?: string;

  @ApiPropertyOptional({
    description:
      'Currency for Stripe subscription checkout. Currently supported only for Stripe payments.',
    enum: STRIPE_SUPPORTED_CURRENCIES,
    example: 'USD',
  })
  @IsOptional()
  @IsIn(STRIPE_SUPPORTED_CURRENCIES)
  currency?: (typeof STRIPE_SUPPORTED_CURRENCIES)[number];
}
