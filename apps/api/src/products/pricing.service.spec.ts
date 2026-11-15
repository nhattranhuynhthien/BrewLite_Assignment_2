import { PricingService } from './pricing.service';

describe('PricingService', () => {
  const service = new PricingService();

  it('calculates unitPrice and lineTotal from integer VND inputs', () => {
    expect(service.calculateLine(30000, 5000, [6000, 8000], 2)).toEqual({
      unitPrice: 49000,
      lineTotal: 98000,
    });
  });

  it.each([0, -1, 1.5, 51])('rejects invalid quantity %s', (quantity) => {
    expect(() => service.calculateLine(30000, 0, [], quantity)).toThrow();
  });

  it('rejects negative prices', () => {
    expect(() => service.calculateLine(30000, -1000, [], 1)).toThrow();
  });
});
