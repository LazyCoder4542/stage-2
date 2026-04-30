import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
export class CreateProfileDto {
  @ApiProperty({ example: 'Adeola' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Transform(({ value }) =>
    typeof value === 'string'
      ? value.replace(/\b\w/g, (c) => c.toUpperCase())
      : value,
  )
  name: string;
}
