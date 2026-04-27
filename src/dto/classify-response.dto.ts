import { ApiProperty } from '@nestjs/swagger';

export class ClassifyDataDto {
  @ApiProperty({ example: 'Adeola' })
  name: string;

  @ApiProperty({ example: 'female', enum: ['male', 'female'] })
  gender: 'male' | 'female';

  @ApiProperty({ example: 0.7 })
  probability: number;

  @ApiProperty({ example: 10195 })
  sample_size: number;

  @ApiProperty({ example: true })
  is_confident: boolean;

  @ApiProperty({ example: '2026-04-17T19:22:00.473Z' })
  processed_at: string;
}

export class ClassifyResponseDto {
  @ApiProperty({ example: 'success' })
  status: string;

  @ApiProperty({ example: '' })
  message: string;

  @ApiProperty({ type: ClassifyDataDto })
  data: ClassifyDataDto;
}
