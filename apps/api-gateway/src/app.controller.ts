import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('System')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'API Gateway status' })
  getStatus() {
    return this.appService.getStatus();
  }

  @Get('services')
  @ApiOperation({ summary: 'Check all services status' })
  async getServicesStatus() {
    return this.appService.checkServicesHealth();
  }
}