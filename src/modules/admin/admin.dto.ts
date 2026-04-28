import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AdminSignupDto {
  @ApiProperty({ description: 'Admin email', example: 'admin@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ description: 'Admin password (min 6 chars)', minLength: 6 })
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty({ description: 'Admin name', example: 'John Admin' })
  @IsString()
  name!: string;
}

export class AdminLoginDto {
  @ApiProperty({ description: 'Admin email', example: 'admin@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ description: 'Admin password' })
  @IsString()
  password!: string;
}

export class CreateTenantDto {
  @ApiProperty({ description: 'Tenant name', example: 'My Restaurant' })
  @IsString()
  @MinLength(3)
  name!: string;

  @ApiProperty({
    description: 'Industry type',
    example: 'restaurant',
    required: false,
  })
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiProperty({
    description: 'Subscription fee',
    example: 129.0,
    required: false,
  })
  @IsOptional()
  subscriptionFee?: number;
}

export class CreateTenantRoleDto {
  @ApiProperty({ description: 'Role name', example: 'Manager' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({
    description: 'Whether role is active',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ListTenantRolesDto {
  @ApiProperty({ default: 1, minimum: 1, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiProperty({ default: 20, minimum: 1, maximum: 100, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;
}

export class CreateTenantUserDto {
  @ApiProperty({ description: 'User full name', example: 'Jane Manager' })
  @IsString()
  @Length(2, 80)
  name!: string;

  @ApiProperty({ description: 'User email', example: 'jane@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ description: '4-digit PIN', example: '1234' })
  @IsString()
  @Length(4, 4)
  pin!: string;

  @ApiProperty({ description: 'Role ID under this tenant' })
  @IsString()
  roleId!: string;

  @ApiProperty({
    description: 'User status',
    example: 'ACTIVE',
    required: false,
    enum: ['ACTIVE', 'INACTIVE'],
  })
  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: 'ACTIVE' | 'INACTIVE';
}

export class ListTenantUsersDto {
  @ApiProperty({ default: 1, minimum: 1, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiProperty({ default: 20, minimum: 1, maximum: 100, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @ApiProperty({ description: 'Search by user name', required: false })
  @IsOptional()
  @IsString()
  search?: string;
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
