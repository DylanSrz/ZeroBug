import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { AppService } from './app.service.js';
import { Public } from './modules/auth/decorators/index.js';

// Hello World del starter; fuera de /api/v1 y de Swagger. Se retirará cuando exista un módulo real en su lugar.
@ApiExcludeController()
@Public()
@Controller({ version: VERSION_NEUTRAL })
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
