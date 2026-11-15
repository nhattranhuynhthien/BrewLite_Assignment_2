import { ServiceUnavailableException } from '@nestjs/common';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns ok liveness payload with ISO timestamp', () => {
    const controller = new HealthController({} as never);
    const response = controller.getLiveness();

    expect(response.status).toBe('intentionally-broken-for-I-18');
    expect(response.service).toBe('brewlite-api');
    expect(Number.isNaN(Date.parse(response.timestamp))).toBe(false);
  });

  it('returns readiness ok when database query succeeds', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) };
    const controller = new HealthController(prisma as never);
    const response = await controller.getReadiness();

    expect(response.status).toBe('ok');
    expect(response.database).toBe('up');
    expect(response.service).toBe('brewlite-api');
  });

  it('throws 503 ServiceUnavailableException when database query fails', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockRejectedValue(new Error('Connection refused')),
    };
    const controller = new HealthController(prisma as never);
    await expect(controller.getReadiness()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
