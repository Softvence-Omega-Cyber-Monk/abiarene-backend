import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';
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

  @ApiProperty({ description: 'Industry type', example: 'restaurant', required: false })
  @IsOptional()
  @IsString()
  industry?: string;

  @ApiProperty({ description: 'Subscription fee', example: 129.0, required: false })
  @IsOptional()
  subscriptionFee?: number;
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
export class ListAdminDto { @IsOptional() @IsString() from?: string; @IsOptional() @IsString() to?: string; }
