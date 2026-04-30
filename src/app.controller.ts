import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';
import { Public } from './decorators/public';

@ApiTags('Classification')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Health check',
    description: 'Returns a hello world message.',
  })
  @ApiResponse({
    status: 200,
    description: 'Service is running.',
    schema: { example: 'Hello World!' },
  })
  @Public()
  getHello(): string {
    return this.appService.getHello();
  }
}
