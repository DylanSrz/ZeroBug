import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

@Controller('health')
@ApiTags('Health')
export class HealthController {
  @Get()
  getHealth() {
    return { status: 'ok', service: 'restaurant-api' };
  }
}
