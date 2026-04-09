import { IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PinLoginDto {
  @ApiProperty({ description: '4-digit user PIN', minLength: 4, maxLength: 4, example: '1234' })
  @IsString()
  @Length(4, 4)
  pin!: string;
}
