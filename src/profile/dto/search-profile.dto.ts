import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsOptional, IsString, MaxLength, IsNumberString, Min, Max, IsNumber } from 'class-validator';

export class SearchProfileDto {
  @ApiProperty({ example: 'young males from nigeria', required: true, description: 'Natural-language search string (e.g. "adult females from ghana", "above 30 males")' })
  @IsString()
  @MaxLength(50)
  q!: string

  @ApiProperty({ example: 1, required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  page?: number

  @ApiProperty({ example: 10, required: false })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(50)
  limit?: number
}