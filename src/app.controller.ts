import { Controller, Get, HttpCode, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';
import { GenderizeDto } from './dto/genderize.dto';
import { ClassifyResponseDto } from './dto/classify-response.dto';

@ApiTags('Classification')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Health check', description: 'Returns a hello world message.' })
  @ApiResponse({ status: 200, description: 'Service is running.', schema: { example: 'Hello World!' } })
  getHello(): string {
    return this.appService.getHello();
  }
}
