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
});
