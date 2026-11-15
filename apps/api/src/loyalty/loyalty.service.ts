import { BadRequestException, Injectable } from '@nestjs/common';
import { LoyaltyType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export const LOYALTY_EARN_UNIT_VND = 10_000;
export const LOYALTY_POINT_VALUE_VND = 1_000;

export interface LoyaltyRedemptionCalc {
  pointsUsed: number;
  discountAmount: number;
}

/** Calculate loyalty points earned from a paid amount (1 point per 10,000 VND). */
export function calculateEarnedPoints(paidAmountVnd: number): number {
  if (paidAmountVnd <= 0) {
    return 0;
  }
  return Math.floor(paidAmountVnd / LOYALTY_EARN_UNIT_VND);
}

@Injectable()
export class LoyaltyService {
  constructor(private readonly db: PrismaService) {}

  /** Compute current available loyalty points for a user. */
  async getBalance(
    client: Pick<Prisma.TransactionClient, 'loyaltyTransaction'>,
    userId: string,
  ): Promise<number> {
    const grouped = await client.loyaltyTransaction.groupBy({
      by: ['type'],
      where: { userId },
      _sum: { points: true },
    });

    let earned = 0;
    let redeemed = 0;
    for (const row of grouped) {
      const sum = row._sum.points ?? 0;
      if (row.type === LoyaltyType.EARN) {
        earned += sum;
      } else if (row.type === LoyaltyType.REDEEM) {
        redeemed += sum;
      }
    }
    return Math.max(0, earned - redeemed);
  }

  /** Return user's current loyalty balance and recent ledger transactions. */
  async getBalanceAndHistory(userId: string) {
    const [balance, transactions] = await Promise.all([
      this.getBalance(this.db, userId),
      this.db.loyaltyTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          orderId: true,
          type: true,
          points: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      balance,
      pointValueVnd: LOYALTY_POINT_VALUE_VND,
      earnUnitVnd: LOYALTY_EARN_UNIT_VND,
      transactions,
    };
  }

  /**
   * Lock the user row inside a transaction, verify requested points against
   * current balance, and cap redeemed points to the remaining payable amount.
   */
  async calculateRedemptionInTransaction(
    tx: Prisma.TransactionClient,
    userId: string,
    requestedPoints: number,
    remainingAmountVnd: number,
  ): Promise<LoyaltyRedemptionCalc> {
    if (requestedPoints <= 0) {
      return { pointsUsed: 0, discountAmount: 0 };
    }

    // Serialize concurrent redemptions on the same user account.
    await tx.$executeRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;

    const balance = await this.getBalance(tx, userId);
    if (requestedPoints > balance) {
      throw new BadRequestException(
        `Số điểm tích lũy không đủ (hiện có ${balance} điểm)`,
      );
    }

    const maxPointsForOrder = Math.floor(
      Math.max(0, remainingAmountVnd) / LOYALTY_POINT_VALUE_VND,
    );
    const pointsUsed = Math.min(requestedPoints, maxPointsForOrder);
    return {
      pointsUsed,
      discountAmount: pointsUsed * LOYALTY_POINT_VALUE_VND,
    };
  }

  /** Record a REDEEM ledger entry after the order row exists. */
  async recordRedemptionInTransaction(
    tx: Prisma.TransactionClient,
    userId: string,
    orderId: string,
    pointsUsed: number,
  ): Promise<void> {
    if (pointsUsed <= 0) {
      return;
    }
    await tx.loyaltyTransaction.create({
      data: {
        userId,
        orderId,
        type: LoyaltyType.REDEEM,
        points: pointsUsed,
      },
    });
  }

  /** Idempotently credit EARN points after an order transitions to PAID. */
  async earnForPaidOrder(
    tx: Prisma.TransactionClient,
    orderId: string,
  ): Promise<number> {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: { id: true, userId: true, totalAmount: true },
    });
    if (!order) {
      return 0;
    }

    const points = calculateEarnedPoints(order.totalAmount);
    if (points <= 0) {
      return 0;
    }

    const existing = await tx.loyaltyTransaction.findFirst({
      where: { orderId, type: LoyaltyType.EARN },
      select: { id: true },
    });
    if (existing) {
      return 0;
    }

    await tx.loyaltyTransaction.create({
      data: {
        userId: order.userId,
        orderId: order.id,
        type: LoyaltyType.EARN,
        points,
      },
    });
    return points;
  }

  /** Refund redeemed points when an order fails payment or expires before payment. */
  async refundOrderRedemption(
    tx: Prisma.TransactionClient,
    orderId: string,
  ): Promise<void> {
    await tx.loyaltyTransaction.deleteMany({
      where: { orderId, type: LoyaltyType.REDEEM },
    });
  }
}
