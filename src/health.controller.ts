import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  health() {
    return {
      ok: true,
      service: 'orvya-deploy-manager',
      timestamp: new Date().toISOString(),
    };
  }
}
