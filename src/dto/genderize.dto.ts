import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class GenderizeDto {
  @ApiProperty({ example: 'Adeola' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name: string;
}
