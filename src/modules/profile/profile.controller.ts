import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../auth/guard/admin.guard';
import { ApiVersionGuard } from './guards/api-version.guard';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBody,
  ApiQuery,
  ApiBearerAuth,
  ApiHeader,
  ApiExtraModels,
  getSchemaPath,
} from '@nestjs/swagger';
import { ProfileService } from './profile.service';
import { CreateProfileDto } from './dto/create-profile.dto';
import { GetProfileDto } from './dto/get-profile.dto';
import { ProfileEntity } from './entities/profile.entity';
import type { Response } from 'express';
import { SearchProfileDto } from './dto/search-profile.dto';

@ApiTags('Profiles')
@ApiBearerAuth('access-token')
@ApiHeader({
  name: 'X-API-Version',
  description: 'Must be 1',
  required: true,
  schema: { default: '1' },
})
@ApiExtraModels(ProfileEntity)
@UseGuards(ApiVersionGuard)
@Controller('profiles')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a profile (Admin only)',
    description:
      'Creates a new profile by predicting gender, age, and nationality from the given name via external APIs. Requires Admin role.',
  })
  @ApiBody({ type: CreateProfileDto })
  @ApiResponse({
    status: 201,
    description: 'New profile created — profile fields are spread at the root.',
    schema: {
      allOf: [
        { properties: { status: { type: 'string', example: 'success' } } },
        { $ref: getSchemaPath(ProfileEntity) },
      ],
    },
  })
  @ApiResponse({
    status: 201,
    description:
      'Profile already existed — returned wrapped under data with a message.',
    schema: {
      properties: {
        status: { type: 'string', example: 'success' },
        message: { type: 'string', example: 'Profile already exists' },
        data: { $ref: getSchemaPath(ProfileEntity) },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'Invalid name or no prediction available for the provided name.',
  })
  @ApiResponse({ status: 403, description: 'Forbidden — Admin role required.' })
  @ApiResponse({
    status: 502,
    description:
      'An upstream API (Genderize / Agify / Nationalize) returned an error.',
  })
  @UseGuards(AdminGuard)
  create(@Body() createProfileDto: CreateProfileDto) {
    return this.profileService.create(createProfileDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all profiles',
    description:
      'Returns paginated profiles with optional filters for gender, age, country, and gender/country probability. Response includes pagination links (self, next, prev).',
  })
  @ApiResponse({
    status: 200,
    description: 'Profiles retrieved successfully.',
    schema: {
      properties: {
        status: { type: 'string', example: 'success' },
        page: { type: 'number', example: 1 },
        limit: { type: 'number', example: 10 },
        total: { type: 'number', example: 100 },
        total_pages: { type: 'number', example: 10 },
        links: {
          type: 'object',
          properties: {
            self: { type: 'string', example: '/profiles?page=1' },
            next: {
              type: 'string',
              nullable: true,
              example: '/profiles?page=2',
            },
            prev: { type: 'string', nullable: true, example: null },
          },
        },
        data: {
          type: 'array',
          items: { $ref: getSchemaPath(ProfileEntity) },
        },
      },
    },
  })
  async findAll(@Query() getProfileDto: GetProfileDto, @Req() req: Request) {
    return this.profileService.findAll(getProfileDto, req.url);
  }

  @Get('search')
  @ApiOperation({
    summary: 'Natural-language profile search',
    description:
      'Parses a natural-language query (e.g. "young males from nigeria") and returns matching profiles.',
  })
  @ApiQuery({
    name: 'q',
    description: 'Natural-language search string',
    example: 'young males from nigeria',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({
    name: 'limit',
    required: false,
    example: 10,
    description: 'Results per page (max 50)',
  })
  @ApiResponse({
    status: 200,
    description: 'Matching profiles returned.',
    schema: {
      properties: {
        status: { type: 'string', example: 'success' },
        page: { type: 'number', example: 1 },
        limit: { type: 'number', example: 10 },
        total: { type: 'number', example: 100 },
        total_pages: { type: 'number', example: 10 },
        links: {
          type: 'object',
          properties: {
            self: {
              type: 'string',
              example: '/profiles/search?q=young+males&page=1',
            },
            next: {
              type: 'string',
              nullable: true,
              example: '/profiles/search?q=young+males&page=2',
            },
            prev: { type: 'string', nullable: true, example: null },
          },
        },
        data: {
          type: 'array',
          items: { $ref: getSchemaPath(ProfileEntity) },
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Query could not be interpreted.' })
  search(@Query() query: SearchProfileDto, @Req() req: Request) {
    return this.profileService.search(query, req.url);
  }

  @Get('export')
  @ApiOperation({
    summary: 'Export profiles as CSV',
    description:
      'Applies the same filters as GET /profiles. Returns a CSV file with all matching profiles.',
  })
  @ApiQuery({
    name: 'format',
    required: true,
    schema: { default: 'csv' },
    description: 'Must be csv',
  })
  @ApiResponse({
    status: 200,
    description:
      'CSV file. Content-Type: text/csv, Content-Disposition: attachment.',
  })
  @ApiResponse({ status: 400, description: 'Unsupported format.' })
  async exportCsv(
    @Query('format') format: string,
    @Query() getProfileDto: GetProfileDto,
    @Res() res: Response,
  ) {
    if (format !== 'csv')
      throw new BadRequestException('Unsupported format. Use format=csv');
    const profiles = await this.profileService.findAllForExport(getProfileDto);
    const timestamp = Date.now();
    const header =
      'id,name,gender,gender_probability,age,age_group,country_id,country_name,country_probability,created_at';
    const rows = profiles.map((p) =>
      [
        p.id,
        p.name,
        p.gender,
        p.gender_probability,
        p.age,
        p.age_group,
        p.country_id,
        p.country_name,
        p.country_probability,
        p.created_at.toISOString(),
      ].join(','),
    );
    const csv = [header, ...rows].join('\n');
    res
      .setHeader('Content-Type', 'text/csv')
      .setHeader(
        'Content-Disposition',
        `attachment; filename="profiles_${timestamp}.csv"`,
      )
      .status(200)
      .send(csv);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a profile by ID' })
  @ApiParam({
    name: 'id',
    description: 'UUID of the profile',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @ApiResponse({
    status: 200,
    description: 'Profile retrieved successfully — fields spread at the root.',
    schema: {
      allOf: [
        { properties: { status: { type: 'string', example: 'success' } } },
        { $ref: getSchemaPath(ProfileEntity) },
      ],
    },
  })
  @ApiResponse({ status: 400, description: 'Profile does not exist.' })
  findOne(@Param('id') id: string) {
    return this.profileService.findOne(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a profile by ID' })
  @ApiParam({
    name: 'id',
    description: 'UUID of the profile',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @ApiResponse({ status: 204, description: 'Profile deleted successfully.' })
  @ApiResponse({ status: 400, description: 'Profile does not exist.' })
  @ApiResponse({ status: 403, description: 'Forbidden — Admin role required.' })
  @UseGuards(AdminGuard)
  async remove(@Res() res: Response, @Param('id') id: string) {
    await this.profileService.remove(id);
    res.status(204).send();
  }
}
