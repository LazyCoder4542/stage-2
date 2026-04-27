import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
  Min,
  Max,
} from 'class-validator';
import { AgeGroup, Gender } from '~gen/prisma/enums';

export enum ProfileSortBy {
  age = 'age',
  created_at = 'created_at',
  gender_probability = 'gender_probability',
}

export enum ProfileOrderBy {
  asc = 'asc',
  desc = 'desc',
}

function IsLessThanOrEqual(property: string, options?: ValidationOptions) {
  return (object: object, propertyName: string) => {
    registerDecorator({
      name: 'isLessThanOrEqual',
      target: (object as any).constructor,
      propertyName,
      constraints: [property],
      options: {
        message: `${propertyName} must be <= ${property}`,
        ...options,
      },
      validator: {
        validate(value: any, args: ValidationArguments) {
          const related = (args.object as any)[args.constraints[0]];
          return (
            value == null || related == null || Number(value) <= Number(related)
          );
        },
      },
    });
  };
}

export class GetProfileDto {
  @ApiProperty({ example: 'male', enum: Gender, required: false })
  @IsOptional()
  @Transform(({ value }) => value?.toLowerCase())
  @IsEnum(Gender)
  gender?: Gender;

  @ApiProperty({ example: 'adult', enum: AgeGroup, required: false })
  @IsOptional()
  @Transform(({ value }) => value?.toLowerCase())
  @IsEnum(AgeGroup)
  age_group?: AgeGroup;

  @ApiProperty({
    example: 'NG',
    required: false,
    description: 'ISO 3166-1 alpha-2 country code',
  })
  @IsOptional()
  @Transform(({ value }) => value?.toUpperCase())
  @IsString()
  @Length(2)
  country_id?: string;

  @ApiProperty({
    example: 16,
    required: false,
    description: 'Minimum predicted age (inclusive)',
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @IsLessThanOrEqual('max_age')
  min_age?: number;

  @ApiProperty({
    example: 24,
    required: false,
    description: 'Maximum predicted age (inclusive)',
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  max_age?: number;

  @ApiProperty({
    example: 0.8,
    required: false,
    description: 'Minimum gender prediction confidence (0–1)',
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  @Max(1)
  min_gender_probability?: number;

  @ApiProperty({
    example: 0.8,
    required: false,
    description: 'Minimum country prediction confidence (0–1)',
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0)
  @Max(1)
  min_country_probability?: number;

  @ApiProperty({
    example: 'age',
    enum: ProfileSortBy,
    required: false,
    description: 'Field to sort results by',
  })
  @IsOptional()
  @IsEnum(ProfileSortBy)
  sort_by?: ProfileSortBy;

  @ApiProperty({
    example: 'desc',
    enum: ProfileOrderBy,
    required: false,
    description: 'Sort direction',
  })
  @IsOptional()
  @IsEnum(ProfileOrderBy)
  order?: ProfileOrderBy;

  @ApiProperty({
    example: 1,
    required: false,
    description: 'Page number (1-indexed)',
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  page?: number;

  @ApiProperty({
    example: 10,
    required: false,
    description: 'Results per page (max 50)',
  })
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(1)
  @Max(50)
  limit?: number;
}
