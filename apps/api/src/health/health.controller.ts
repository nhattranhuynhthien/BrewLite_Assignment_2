import {
  Controller,
  Get,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

export interface HealthPayload {
  status: 'ok';
  database?: 'up';
  service: 'brewlite-api';
  timestamp: string;
}

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Kiểm tra sẵn sàng API và kết nối PostgreSQL' })
  @ApiResponse({ status: 200, description: 'API và PostgreSQL sẵn sàng' })
  @ApiResponse({ status: 503, description: 'Mất kết nối PostgreSQL' })
  async getReadiness(): Promise<HealthPayload> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        database: 'up',
        service: 'brewlite-api',
        timestamp: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        database: 'down',
        service: 'brewlite-api',
        timestamp: new Date().toISOString(),
      });
    }
  }

  @Get('live')
  @ApiOperation({ summary: 'Kiểm tra tiến trình API đang hoạt động' })
  @ApiResponse({ status: 200, description: 'API process alive' })
  getLiveness(): HealthPayload {
    return {
      status: 'ok',
      service: 'brewlite-api',
      timestamp: new Date().toISOString(),
    };
  }
}
