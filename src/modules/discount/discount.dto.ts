import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CreateDiscountDto {
  @ApiProperty({ description: 'Discount name', example: 'Weekend Offer' })
  @IsString()
  name!: string;

  @ApiProperty({ description: 'Minimum order price required for this discount', example: 100 })
  @Type(() => Number)
  @IsNumber()
  minimumPrice!: number;

  @ApiProperty({ description: 'Discount percentage off', example: 10 })
  @Type(() => Number)
  @IsNumber()
  offPrice!: number;

  @ApiPropertyOptional({ description: 'Whether this discount is active', example: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateDiscountDto extends PartialType(CreateDiscountDto) {}

export class ListDiscountDto {
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

  @ApiPropertyOptional({ description: 'Filter discounts by active state', example: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}
