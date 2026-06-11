import {
  IsEmail,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  Matches,
  Min,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

export const SUBSCRIPTION_PLAN_TYPES = [
  'FREE',
  'MONTHLY',
  'YEARLY',
] as const;

export type SubscriptionPlanType = (typeof SUBSCRIPTION_PLAN_TYPES)[number];

export class AdminSignupDto {
  @ApiProperty({ description: 'Admin email', example: 'admin@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({
    description: 'Admin 4-digit PIN',
    minLength: 4,
    maxLength: 4,
    pattern: '^\\d{4}$',
    example: '1234',
  })
  @IsString()
  @Matches(/^\d{4}$/, { message: 'PIN must be exactly 4 digits' })
  pin!: string;

  @ApiProperty({ description: 'Admin name', example: 'John Admin' })
  @IsString()
  name!: string;
}

export class AdminResponse {
  @ApiProperty()
  id: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  createdAt: Date;
}

export class CreateAdminDto {}
export class UpdateAdminDto {}
export class ListAdminDto {
  @IsOptional() @IsString() from?: string;
  @IsOptional() @IsString() to?: string;
}

export class CreateSubscriptionPriceDto {
  @ApiProperty({
    enum: SUBSCRIPTION_PLAN_TYPES,
    example: 'MONTHLY',
  })
  @IsIn(SUBSCRIPTION_PLAN_TYPES)
  planType!: SubscriptionPlanType;

  @ApiPropertyOptional({ example: 'Base monthly subscription price' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: 99.99 })
  @IsNumber()
  @Min(0)
  amount!: number;

  @ApiPropertyOptional({ example: 'USD', default: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateSubscriptionPriceDto extends PartialType(CreateSubscriptionPriceDto) {}

export class CreateSubscriptionVoucherDto {
  @ApiProperty({ example: 'TENANT-OFFER-100' })
  @IsString()
  code!: string;

  @ApiProperty({ example: 25 })
  @IsNumber()
  @Min(0)
  amountOff!: number;

  @ApiPropertyOptional({
    example: '2026-12-31T23:59:59.000Z',
    description: 'Optional voucher expiry date',
  })
  @IsOptional()
  @IsString()
  expiresAt?: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateSubscriptionVoucherDto extends PartialType(CreateSubscriptionVoucherDto) {}
