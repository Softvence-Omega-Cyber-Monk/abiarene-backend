import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

export class CreateUsersDto {
  @ApiProperty({ description: 'User full name', minLength: 2, maxLength: 80 })
  @IsString()
  @Length(2, 80)
  name!: string;

  @ApiProperty({ description: '4-digit PIN', minLength: 4, maxLength: 4 })
  @IsString()
  @Length(4, 4)
  pin!: string;

  @ApiProperty({ description: 'Role ID' })
  @IsString()
  roleId!: string;
}

export class UpdateUsersDto extends PartialType(CreateUsersDto) {
  @ApiPropertyOptional({ enum: ['ACTIVE', 'INACTIVE'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: 'ACTIVE' | 'INACTIVE';
}

export class ListUsersDto {
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

  @ApiPropertyOptional({ description: 'Search by user name' })
  @IsOptional()
  @IsString()
  search?: string;
}
