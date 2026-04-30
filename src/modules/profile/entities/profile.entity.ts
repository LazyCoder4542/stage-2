import { ApiProperty } from '@nestjs/swagger';
import { AgeGroup, Gender } from '~gen/prisma/enums';

export class ProfileEntity {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id!: string;

  @ApiProperty({ example: 'Adeola' })
  name!: string;

  @ApiProperty({ enum: Gender, example: Gender.male })
  gender!: Gender;

  @ApiProperty({
    example: 0.7,
    description: 'Probability of the predicted gender (0-1)',
  })
  gender_probability!: number;

  @ApiProperty({ example: 28, description: 'Predicted age' })
  age!: number;

  @ApiProperty({ enum: AgeGroup, example: AgeGroup.adult })
  age_group!: AgeGroup;

  @ApiProperty({
    example: 'NG',
    description: 'ISO 3166-1 alpha-2 country code',
  })
  country_id!: string;

  @ApiProperty({
    example: 'Nigeria',
    description: 'Full country name resolved from country_id',
  })
  country_name!: string;

  @ApiProperty({
    example: 0.4,
    description: 'Probability of the predicted country (0-1)',
  })
  country_probability!: number;

  @ApiProperty({ example: '2026-04-17T19:22:00.473Z' })
  created_at!: Date;
}
