import { BadRequestException } from '@nestjs/common';
import { DiscountType, Prisma, Promotion } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  calculatePromoDiscount,
  PromotionsService,
} from './promotions.service';

function makePromo(overrides: Partial<Promotion> = {}): Promotion {
  const now = Date.now();
  return {
    id: 'promo-1',
    code: 'BREWLITE10',
    discountType: DiscountType.PERCENT,
    discountValue: 10,
    minOrderAmount: 30000,
    startsAt: new Date(now - 60_000),
    endsAt: new Date(now + 60_000),
    usageLimit: 100,
    usedCount: 5,
    isActive: true,
    ...overrides,
  };
}

describe('PromotionsService', () => {
  it('computes PERCENT and FIXED_AMOUNT discounts capped at subtotal', () => {
    expect(
      calculatePromoDiscount(
        { discountType: DiscountType.PERCENT, discountValue: 10 },
        41000,
      ),
    ).toBe(4100);
    expect(
      calculatePromoDiscount(
        { discountType: DiscountType.FIXED_AMOUNT, discountValue: 50000 },
        35000,
      ),
    ).toBe(35000);
  });

  it('lists active promotions filtering out exhausted usage limits', async () => {
    const db = {
      promotion: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            makePromo({ code: 'OPEN', usageLimit: null, usedCount: 50 }),
            makePromo({ code: 'EXHAUSTED', usageLimit: 5, usedCount: 5 }),
            makePromo({ code: 'VALID', usageLimit: 10, usedCount: 9 }),
          ]),
      },
    };
    const service = new PromotionsService(db as unknown as PrismaService);

    const active = await service.listActive();

    expect(active.map((p) => p.code)).toEqual(['OPEN', 'VALID']);
  });

  it('validates trimmed lowercase code and returns calculated discount', async () => {
    const promo = makePromo();
    const db = {
      promotion: {
        findFirst: jest.fn().mockResolvedValue(promo),
      },
    };
    const service = new PromotionsService(db as unknown as PrismaService);

    const result = await service.validateForSubtotal('  brewlite10  ', 65000);

    expect(result).toEqual({
      valid: true,
      promotionId: 'promo-1',
      code: 'BREWLITE10',
      discountType: DiscountType.PERCENT,
      discountValue: 10,
      minOrderAmount: 30000,
      discountAmount: 6500,
      finalSubtotal: 58500,
    });
  });

  it.each([
    ['unknown', null],
    ['inactive', makePromo({ isActive: false })],
    [
      'expired',
      makePromo({
        endsAt: new Date(Date.now() - 1000),
      }),
    ],
    [
      'not started',
      makePromo({
        startsAt: new Date(Date.now() + 60_000),
      }),
    ],
    ['below minimum', makePromo({ minOrderAmount: 100000 })],
    ['limit reached', makePromo({ usageLimit: 5, usedCount: 5 })],
  ])('rejects %s promo with BadRequestException', async (_label, promo) => {
    const db = {
      promotion: {
        findFirst: jest.fn().mockResolvedValue(promo),
      },
    };
    const service = new PromotionsService(db as unknown as PrismaService);

    await expect(
      service.validateForSubtotal('BREWLITE10', 45000),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws when concurrent reservation fails conditional updateMany', async () => {
    const promo = makePromo({ usageLimit: 10, usedCount: 9 });
    const tx = {
      promotion: {
        findFirst: jest.fn().mockResolvedValue(promo),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const service = new PromotionsService({} as unknown as PrismaService);

    await expect(
      service.reserveInTransaction(
        tx as unknown as Prisma.TransactionClient,
        'BREWLITE10',
        50000,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('releases a reserved promotion usage count safely', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const tx = { promotion: { updateMany } };
    const service = new PromotionsService({} as unknown as PrismaService);

    await service.releaseInTransaction(
      tx as unknown as Prisma.TransactionClient,
      'promo-1',
    );

    expect(updateMany).toHaveBeenCalledWith({
      where: { id: 'promo-1', usedCount: { gt: 0 } },
      data: { usedCount: { decrement: 1 } },
    });
  });
});
