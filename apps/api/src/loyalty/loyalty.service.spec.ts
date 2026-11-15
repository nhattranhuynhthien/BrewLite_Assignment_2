import { BadRequestException } from '@nestjs/common';
import { LoyaltyType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { calculateEarnedPoints, LoyaltyService } from './loyalty.service';

describe('LoyaltyService', () => {
  it('calculates 1 point per 10,000 VND floored and 0 below 10,000 VND', () => {
    expect(calculateEarnedPoints(0)).toBe(0);
    expect(calculateEarnedPoints(9999)).toBe(0);
    expect(calculateEarnedPoints(10000)).toBe(1);
    expect(calculateEarnedPoints(49500)).toBe(4);
  });

  it('computes net balance and returns history', async () => {
    const db = {
      loyaltyTransaction: {
        groupBy: jest.fn().mockResolvedValue([
          { type: LoyaltyType.EARN, _sum: { points: 25 } },
          { type: LoyaltyType.REDEEM, _sum: { points: 10 } },
        ]),
        findMany: jest.fn().mockResolvedValue([]),
      },
    };
    const service = new LoyaltyService(db as unknown as PrismaService);

    const res = await service.getBalanceAndHistory('user-1');

    expect(res.balance).toBe(15);
    expect(res.pointValueVnd).toBe(1000);
    expect(res.earnUnitVnd).toBe(10000);
  });

  it('locks user and caps redeemed points to remaining payable amount', async () => {
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      loyaltyTransaction: {
        groupBy: jest
          .fn()
          .mockResolvedValue([
            { type: LoyaltyType.EARN, _sum: { points: 100 } },
          ]),
      },
    };
    const service = new LoyaltyService({} as unknown as PrismaService);

    const res = await service.calculateRedemptionInTransaction(
      tx as unknown as Prisma.TransactionClient,
      '11111111-1111-4111-8111-111111111111',
      50,
      35500,
    );

    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(res).toEqual({ pointsUsed: 35, discountAmount: 35000 });
  });

  it('rejects redemption exceeding available balance', async () => {
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      loyaltyTransaction: {
        groupBy: jest
          .fn()
          .mockResolvedValue([{ type: LoyaltyType.EARN, _sum: { points: 5 } }]),
      },
    };
    const service = new LoyaltyService({} as unknown as PrismaService);

    await expect(
      service.calculateRedemptionInTransaction(
        tx as unknown as Prisma.TransactionClient,
        '11111111-1111-4111-8111-111111111111',
        10,
        50000,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('earns points idempotently for paid orders and avoids duplicates', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'lt-1' });
    const findFirst = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'lt-1' });
    const tx = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'order-1',
          userId: 'user-1',
          totalAmount: 41000,
        }),
      },
      loyaltyTransaction: {
        findFirst,
        create,
      },
    };
    const service = new LoyaltyService({} as unknown as PrismaService);

    const first = await service.earnForPaidOrder(
      tx as unknown as Prisma.TransactionClient,
      'order-1',
    );
    const second = await service.earnForPaidOrder(
      tx as unknown as Prisma.TransactionClient,
      'order-1',
    );

    expect(first).toBe(4);
    expect(second).toBe(0);
    expect(create).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        orderId: 'order-1',
        type: LoyaltyType.EARN,
        points: 4,
      },
    });
  });
});
