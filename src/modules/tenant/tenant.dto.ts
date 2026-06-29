import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto.js';

export const INDUSTRY_TYPES = [
  'RESTAURANT',
  'BAR',
  'SUPERMARKET',
  'HARDWARE_STORE',
  'WINE_SHOP',
  'CLOTHING_AND_FASHION_SHOP',
  'BOOKSHOP',
  'COSMETIC_AND_SKINCARE_SHOP',
  'CONSTRUCTION_SHOP',
  'OTHER',
] as const;

export type IndustryType = (typeof INDUSTRY_TYPES)[number];

export const PAYSTACK_SUPPORTED_CURRENCIES = [
  'NGN',
  'USD',
  'GHS',
  'ZAR',
  'KES',
  'XOF',
] as const;

export const OVERVIEW_GRAPH_RANGES = [
  'daily',
  'weekly',
  'monthly',
  'quarterly',
  'yearly',
] as const;

export type OverviewGraphRange = (typeof OVERVIEW_GRAPH_RANGES)[number];

export class CreateTenantDto {
  @ApiProperty({ description: 'Tenant name' })
  @IsString()
  @MinLength(3)
  name!: string;

  @ApiPropertyOptional({
    description: 'Tenant industry',
    enum: INDUSTRY_TYPES,
    example: 'HARDWARE_STORE',
  })
  @IsOptional()
  @IsIn(INDUSTRY_TYPES)
  industry?: IndustryType;

  @ApiProperty({
    description: 'ISO 3166-1 alpha-2 country code',
    example: 'BD',
  })
  @IsString()
  @Length(2, 2)
  countryCode!: string;

  @ApiProperty({
    description: 'ISO 4217 currency code',
    example: 'BDT',
  })
  @IsString()
  @Length(3, 3)
  currencyCode!: string;

  @ApiPropertyOptional({ description: 'Mobile logo URL', example: 'https://example.com/mobile-logo.png' })
  @IsOptional()
  @IsString()
  mobileLogo?: string;

  @ApiPropertyOptional({ description: 'Tablet logo URL', example: 'https://example.com/tablet-logo.png' })
  @IsOptional()
  @IsString()
  tabletLogo?: string;

  @ApiProperty({
    description: 'Selected subscription price ID created by admin',
    example: 'subscription-price-id',
  })
  @IsString()
  subscriptionPriceId!: string;

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

  @ApiPropertyOptional({
    description: 'Tenant industry',
    enum: INDUSTRY_TYPES,
    example: 'SUPERMARKET',
  })
  @IsOptional()
  @IsIn(INDUSTRY_TYPES)
  industry?: IndustryType;

  @ApiPropertyOptional({
    description: 'ISO 3166-1 alpha-2 country code',
    example: 'BD',
  })
  @IsOptional()
  @IsString()
  @Length(2, 2)
  countryCode?: string;

  @ApiPropertyOptional({
    description: 'ISO 4217 currency code',
    example: 'BDT',
  })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currencyCode?: string;

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

export class OverviewQueryDto {
  @ApiPropertyOptional({
    description: 'Graph range for tenant overview trend data',
    enum: OVERVIEW_GRAPH_RANGES,
    example: 'daily',
    default: 'daily',
  })
  @IsOptional()
  @IsIn(OVERVIEW_GRAPH_RANGES)
  range?: OverviewGraphRange;
}

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
      'ISO 4217 currency code for subscription checkout. Stripe accepts a broad set of supported currencies; Paystack supports NGN, USD, GHS, ZAR, KES, XOF.',
    example: 'USD',
  })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  @Matches(/^[A-Z]{3}$/, {
    message: 'currency must be a 3-letter uppercase ISO 4217 code',
  })
  currency?: string;

  @ApiPropertyOptional({
    description: 'Tenant-scoped subscription voucher code created by admin',
    example: 'TENANT-OFFER-100',
  })
  @IsOptional()
  @IsString()
  voucherCode?: string;
}
