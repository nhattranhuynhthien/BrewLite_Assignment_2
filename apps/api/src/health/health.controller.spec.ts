import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns ok liveness payload with ISO timestamp', () => {
    const controller = new HealthController();
    const response = controller.getLiveness();

    expect(response.status).toBe('ok');
    expect(response.service).toBe('brewlite-api');
    expect(Number.isNaN(Date.parse(response.timestamp))).toBe(false);
  });
});
