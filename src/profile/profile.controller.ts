import { Controller, Get, Post, Body, Param, Delete, Query, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody, ApiQuery } from '@nestjs/swagger';
import { ProfileService } from './profile.service';
import { CreateProfileDto } from './dto/create-profile.dto';
import { GetProfileDto } from './dto/get-profile.dto';
import { ProfileEntity } from './entities/profile.entity';
import type { Response } from 'express';
import { SearchProfileDto } from './dto/search-profile.dto';

@ApiTags('Profiles')
@Controller('profiles')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Post()
  @ApiOperation({ summary: 'Create a profile', description: 'Creates a new profile by predicting gender, age, and nationality from the given name via external APIs.' })
  @ApiBody({ type: CreateProfileDto })
  @ApiResponse({ status: 201, description: 'Profile created successfully.', type: ProfileEntity })
  @ApiResponse({ status: 200, description: 'Profile already exists, returns the existing record.' })
  @ApiResponse({ status: 400, description: 'Invalid name or no prediction available for the provided name.' })
  @ApiResponse({ status: 502, description: 'An upstream API (Genderize / Agify / Nationalize) returned an error.' })
  create(@Body() createProfileDto: CreateProfileDto) {
    return this.profileService.create(createProfileDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all profiles', description: 'Returns all profiles with optional filters for gender, country, and age group.' })
  @ApiResponse({ status: 200, description: 'Profiles retrieved successfully.', type: [ProfileEntity] })
  async findAll(@Query() getProfileDto: GetProfileDto) {
    return this.profileService.findAll(getProfileDto);
  }

  @Get('search')
  @ApiOperation({ summary: 'Natural-language profile search', description: 'Parses a natural-language query (e.g. "young males from nigeria") and returns matching profiles.' })
  @ApiQuery({ name: 'q', description: 'Natural-language search string', example: 'young males from nigeria' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 10, description: 'Results per page (max 50)' })
  @ApiResponse({ status: 200, description: 'Matching profiles returned.', type: [ProfileEntity] })
  @ApiResponse({ status: 400, description: 'Query could not be interpreted.' })
  search(@Query() query: SearchProfileDto) {
    return this.profileService.search(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a profile by ID' })
  @ApiParam({ name: 'id', description: 'UUID of the profile', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully.', type: ProfileEntity })
  @ApiResponse({ status: 400, description: 'Profile does not exist.' })
  findOne(@Param('id') id: string) {
    return this.profileService.findOne(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a profile by ID' })
  @ApiParam({ name: 'id', description: 'UUID of the profile', example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @ApiResponse({ status: 204, description: 'Profile deleted successfully.' })
  @ApiResponse({ status: 400, description: 'Profile does not exist.' })
  async remove(@Res() res: Response, @Param('id') id: string) {
    await this.profileService.remove(id);
    res.status(204).send();
  }
}
