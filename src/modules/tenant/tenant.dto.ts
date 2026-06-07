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

export const PAYSTACK_SUPPORTED_CURRENCIES = [
  'NGN',
  'USD',
  'GHS',
  'ZAR',
  'KES',
  'XOF',
] as const;

export const SUBSCRIPTION_PAYMENT_SUPPORTED_CURRENCIES = [
  ...new Set([
    ...STRIPE_SUPPORTED_CURRENCIES,
    ...PAYSTACK_SUPPORTED_CURRENCIES,
  ]),
] as const;

export class CreateTenantDto {
  @ApiProperty({ description: 'Tenant name' })
  @IsString()
  @MinLength(3)
  name!: string;

  @ApiPropertyOptional({ description: 'Tenant industry', example: 'hardware' })
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiPropertyOptional({ description: 'Mobile logo URL', example: 'https://example.com/mobile-logo.png' })
  @IsOptional()
  @IsString()
  mobileLogo?: string;

  @ApiPropertyOptional({ description: 'Tablet logo URL', example: 'https://example.com/tablet-logo.png' })
  @IsOptional()
  @IsString()
  tabletLogo?: string;

  @ApiPropertyOptional({ description: 'Subscription fee', example: 99.99 })
  @IsOptional()
  @IsNumber()
  subscriptionFee?: number;

  @ApiPropertyOptional({
    description: 'Start the tenant with a 7-day free trial before subscription payment is required',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  startWithFreeTrial?: boolean;

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

  @ApiPropertyOptional({ description: 'Tenant industry', example: 'supershop' })
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiPropertyOptional({ description: 'Mobile logo URL', example: 'https://example.com/mobile-logo.png' })
  @IsOptional()
  @IsString()
  mobileLogo?: string;

  @ApiPropertyOptional({ description: 'Tablet logo URL', example: 'https://example.com/tablet-logo.png' })
  @IsOptional()
  @IsString()
  tabletLogo?: string;
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
      'Currency for subscription checkout. Stripe supports a wider set, Paystack supports NGN, USD, GHS, ZAR, KES, XOF.',
    enum: SUBSCRIPTION_PAYMENT_SUPPORTED_CURRENCIES,
    example: 'USD',
  })
  @IsOptional()
  @IsIn(SUBSCRIPTION_PAYMENT_SUPPORTED_CURRENCIES)
  currency?: (typeof SUBSCRIPTION_PAYMENT_SUPPORTED_CURRENCIES)[number];

  @ApiPropertyOptional({
    description: 'Tenant-scoped subscription voucher code created by admin',
    example: 'TENANT-OFFER-100',
  })
  @IsOptional()
  @IsString()
  voucherCode?: string;
}
