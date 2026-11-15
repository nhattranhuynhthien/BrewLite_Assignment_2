import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PricingService } from '../products/pricing.service';
import { OrdersService } from './orders.service';

describe('OrdersService', () => {
  it('never writes outside the transaction when stock reservation fails', async () => {
    const tx = { order: { create: jest.fn() } };
    const db = {
      $transaction: jest.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
    };
    const products = {
      getProductForOrder: jest.fn().mockResolvedValue({
        id: 'p',
        name: 'Coffee',
        isAvailable: true,
        basePrice: 30000,
        sizes: [{ id: 's', name: 'M', extraPrice: 0 }],
        toppings: [],
      }),
      decreaseStock: jest.fn().mockResolvedValue(false),
    };

    const service = new OrdersService(
      db as never,
      products as never,
      new PricingService(),
    );

    await expect(
      service.createOrder('u', {
        items: [{ productId: 'p', sizeId: 's', toppingIds: [], quantity: 1 }],
      }),
    ).rejects.toThrow();
    expect(tx.order.create).not.toHaveBeenCalled();
  });

  it('throws 404 for unknown order and 403 when order belongs to another user', async () => {
    const db = {
      order: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ id: 'o1', userId: 'other-user' }),
      },
    };
    const service = new OrdersService(
      db as never,
      {} as never,
      new PricingService(),
    );

    await expect(service.findOwnedOrder('u1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.findOwnedOrder('u1', 'o1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('applies promo and loyalty discounts, caps total >= 0, and refunds on failure', async () => {
    const orderCreate = jest.fn().mockResolvedValue({
      id: 'order-1',
      subtotal: 41000,
      discountAmount: 9100,
      totalAmount: 31900,
      promotionId: 'promo-1',
    });
    const tx = {
      order: {
        create: orderCreate,
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findUnique: jest.fn().mockResolvedValue({ promotionId: 'promo-1' }),
      },
      orderItem: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ productId: 'p', quantity: 1 }]),
      },
    };
    const db = {
      $transaction: jest.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
    };
    const products = {
      getProductForOrder: jest.fn().mockResolvedValue({
        id: 'p',
        name: 'Coffee',
        isAvailable: true,
        basePrice: 30000,
        sizes: [{ id: 's', name: 'M', extraPrice: 5000 }],
        toppings: [
          {
            topping: {
              id: 't',
              name: 'Pearl',
              extraPrice: 6000,
              isAvailable: true,
            },
          },
        ],
      }),
      decreaseStock: jest.fn().mockResolvedValue(true),
      restoreStock: jest.fn().mockResolvedValue(undefined),
    };
    const promotions = {
      reserveInTransaction: jest.fn().mockResolvedValue({
        promotion: { id: 'promo-1' },
        discountAmount: 4100,
      }),
      releaseInTransaction: jest.fn().mockResolvedValue(undefined),
    };
    const loyalty = {
      calculateRedemptionInTransaction: jest.fn().mockResolvedValue({
        pointsUsed: 5,
        discountAmount: 5000,
      }),
      recordRedemptionInTransaction: jest.fn().mockResolvedValue(undefined),
      earnForPaidOrder: jest.fn().mockResolvedValue(3),
      refundOrderRedemption: jest.fn().mockResolvedValue(undefined),
    };

    const service = new OrdersService(
      db as never,
      products as never,
      new PricingService(),
      promotions as never,
      loyalty as never,
    );

    const created = await service.createOrder('u1', {
      items: [{ productId: 'p', sizeId: 's', toppingIds: ['t'], quantity: 1 }],
      promoCode: 'BREWLITE10',
      redeemPoints: 5,
    });

    expect(created.totalAmount).toBe(31900);
    expect(loyalty.calculateRedemptionInTransaction).toHaveBeenCalledWith(
      tx,
      'u1',
      5,
      36900,
    );
    expect(loyalty.recordRedemptionInTransaction).toHaveBeenCalledWith(
      tx,
      'u1',
      'order-1',
      5,
    );

    await service.markPaid('order-1', tx as never);
    expect(loyalty.earnForPaidOrder).toHaveBeenCalledWith(tx, 'order-1');

    await service.markPaymentFailed('order-1', tx as never);
    expect(promotions.releaseInTransaction).toHaveBeenCalledWith(tx, 'promo-1');
    expect(loyalty.refundOrderRedemption).toHaveBeenCalledWith(tx, 'order-1');
  });
});
