import { IsEmail, IsString, Matches, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterOwnerDto {
  @ApiProperty({ description: 'Owner name', example: 'Sara Owner' })
  @IsString()
  @MinLength(2)
  name!: string;

  @ApiProperty({ description: 'Owner email', example: 'owner@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({
    description: '4-digit owner PIN',
    minLength: 4,
    maxLength: 4,
    pattern: '^\\d{4}$',
    example: '1234',
  })
  @IsString()
  @Matches(/^\d{4}$/, { message: 'PIN must be exactly 4 digits' })
  pin!: string;
}

/** @deprecated Use RegisterOwnerDto */
export class RegisterSupervisorDto extends RegisterOwnerDto {}

export class LoginDto {
  @ApiProperty({
    description: '4-digit user PIN',
    minLength: 4,
    maxLength: 4,
    pattern: '^\\d{4}$',
    example: '1234',
  })
  @IsString()
  @Matches(/^\d{4}$/, { message: 'PIN must be exactly 4 digits' })
  pin!: string;

  @ApiProperty({ description: 'User email', example: 'user@example.com' })
  @IsEmail()
  email!: string;
}

export class TenantResponse {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  industry: string;

  @ApiProperty()
  countryCode: string;

  @ApiProperty()
  currencyCode: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  createdAt: Date;
}

export class UserResponse {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  email: string;

  @ApiProperty()
  role: { id: string; name: string; isActive: boolean };

  @ApiProperty()
  status: string;

  @ApiProperty()
  createdAt: Date;
}
