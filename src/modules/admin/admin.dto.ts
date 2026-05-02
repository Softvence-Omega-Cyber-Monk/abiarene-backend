import {
  IsEmail,
  IsOptional,
  IsString,
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
  @ApiProperty({ description: 'Admin email', example: 'admin@gmail.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ description: 'Admin password', example: 'admin@gmail.com' })
  @IsString()
  password!: string;
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
