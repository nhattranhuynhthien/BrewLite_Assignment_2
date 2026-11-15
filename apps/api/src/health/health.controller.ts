import { Controller, Get } from '@nestjs/common';

export interface HealthPayload {
  status: 'ok';
  service: 'brewlite-api';
  timestamp: string;
}

@Controller('health')
export class HealthController {
  @Get()
  getHealth(): HealthPayload {
    return {
      status: 'ok',
      service: 'brewlite-api',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('live')
  getLiveness(): HealthPayload {
    return {
      status: 'ok',
      service: 'brewlite-api',
      timestamp: new Date().toISOString(),
    };
  }
}
