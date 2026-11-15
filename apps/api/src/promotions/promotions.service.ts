import { BadRequestException, Injectable } from '@nestjs/common';
import { DiscountType, Prisma, Promotion } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface ValidatedPromotionResult {
  valid: true;
  promotionId: string;
  code: string;
  discountType: DiscountType;
  discountValue: number;
  minOrderAmount: number;
  discountAmount: number;
  finalSubtotal: number;
}

export interface ReservedPromotion {
  promotion: Promotion;
  discountAmount: number;
}

/** Normalize user-entered promotion codes for case-insensitive lookup. */
export function normalizePromoCode(rawCode: string): string {
  return rawCode.trim().toUpperCase();
}

/** Compute integer VND discount clamped between 0 and subtotal. */
export function calculatePromoDiscount(
  promo: Pick<Promotion, 'discountType' | 'discountValue'>,
  subtotal: number,
): number {
  if (subtotal <= 0 || promo.discountValue <= 0) {
    return 0;
  }
  const raw =
    promo.discountType === DiscountType.PERCENT
      ? Math.floor((subtotal * promo.discountValue) / 100)
      : promo.discountValue;
  return Math.max(0, Math.min(subtotal, raw));
}

function assertPromotionEligible(
  promo: Promotion | null,
  subtotal: number,
  now: Date,
): asserts promo is Promotion {
  if (!promo || !promo.isActive) {
    throw new BadRequestException(
      'Mã khuyến mãi không tồn tại hoặc đã ngừng áp dụng',
    );
  }
  if (now < promo.startsAt || now > promo.endsAt) {
    throw new BadRequestException(
      'Mã khuyến mãi chưa đến thời gian áp dụng hoặc đã hết hạn',
    );
  }
  if (subtotal < promo.minOrderAmount) {
    throw new BadRequestException(
      `Đơn hàng tối thiểu ${promo.minOrderAmount.toLocaleString('vi-VN')}₫ để áp dụng mã ${promo.code}`,
    );
  }
  if (promo.usageLimit !== null && promo.usedCount >= promo.usageLimit) {
    throw new BadRequestException('Mã khuyến mãi đã hết lượt sử dụng');
  }
}

@Injectable()
export class PromotionsService {
  constructor(private readonly db: PrismaService) {}

  /** List currently active promotions with remaining usage slots. */
  async listActive(now = new Date()) {
    const rows = await this.db.promotion.findMany({
      where: {
        isActive: true,
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
      orderBy: { code: 'asc' },
    });

    return rows
      .filter(
        (promo) =>
          promo.usageLimit === null || promo.usedCount < promo.usageLimit,
      )
      .map((promo) => ({
        id: promo.id,
        code: promo.code,
        discountType: promo.discountType,
        discountValue: promo.discountValue,
        minOrderAmount: promo.minOrderAmount,
        startsAt: promo.startsAt,
        endsAt: promo.endsAt,
        usageLimit: promo.usageLimit,
        usedCount: promo.usedCount,
      }));
  }

  /** Validate a promotion code for a given subtotal without mutating usage counts. */
  async validateForSubtotal(
    rawCode: string,
    subtotal: number,
    now = new Date(),
  ): Promise<ValidatedPromotionResult> {
    const code = normalizePromoCode(rawCode);
    if (!code) {
      throw new BadRequestException('Vui lòng nhập mã khuyến mãi');
    }

    const promo = await this.db.promotion.findFirst({
      where: { code: { equals: code, mode: 'insensitive' } },
    });
    assertPromotionEligible(promo, subtotal, now);

    const discountAmount = calculatePromoDiscount(promo, subtotal);
    return {
      valid: true,
      promotionId: promo.id,
      code: promo.code,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      minOrderAmount: promo.minOrderAmount,
      discountAmount,
      finalSubtotal: Math.max(0, subtotal - discountAmount),
    };
  }

  /**
   * Atomically validate and reserve one promotion usage inside an order transaction.
   * Uses a conditional updateMany guard to enforce usageLimit under concurrency.
   */
  async reserveInTransaction(
    tx: Prisma.TransactionClient,
    rawCode: string,
    subtotal: number,
    now = new Date(),
  ): Promise<ReservedPromotion> {
    const code = normalizePromoCode(rawCode);
    if (!code) {
      throw new BadRequestException('Mã khuyến mãi không hợp lệ');
    }

    const promo = await tx.promotion.findFirst({
      where: { code: { equals: code, mode: 'insensitive' } },
    });
    assertPromotionEligible(promo, subtotal, now);

    const updated = await tx.promotion.updateMany({
      where: {
        id: promo.id,
        isActive: true,
        startsAt: { lte: now },
        endsAt: { gte: now },
        ...(promo.usageLimit !== null
          ? { usedCount: { lt: promo.usageLimit } }
          : {}),
      },
      data: { usedCount: { increment: 1 } },
    });

    if (updated.count !== 1) {
      throw new BadRequestException(
        'Mã khuyến mãi đã hết lượt sử dụng hoặc không còn hiệu lực',
      );
    }

    const discountAmount = calculatePromoDiscount(promo, subtotal);
    return { promotion: promo, discountAmount };
  }

  /** Release one reserved usage slot when a pending order fails payment or expires. */
  async releaseInTransaction(
    tx: Prisma.TransactionClient,
    promotionId: string,
  ): Promise<void> {
    await tx.promotion.updateMany({
      where: { id: promotionId, usedCount: { gt: 0 } },
      data: { usedCount: { decrement: 1 } },
    });
  }
}
