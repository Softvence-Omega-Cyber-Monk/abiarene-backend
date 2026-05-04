import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto.js';

export class CreateMenuDto {
  @ApiPropertyOptional({ description: 'Item image URL', example: 'https://example.com/item.jpg' })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiProperty({ description: 'Item name' })
  @IsString()
  name!: string;

  @ApiProperty({ description: 'Item category', example: 'Pizza' })
  @IsString()
  category!: string;

  @ApiPropertyOptional({ description: 'Item description', example: 'Grilled chicken patty with cheese and sauce' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Item price', example: 12.5 })
  @Type(() => Number)
  @IsNumber()
  price!: number;

  @ApiPropertyOptional({ description: 'Whether the item is active', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateMenuDto extends PartialType(CreateMenuDto) {}

export class ListMenuDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Search by item name or category' })
  @IsOptional()
  @IsString()
  search?: string;

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
