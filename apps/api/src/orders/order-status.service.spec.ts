import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { NEXT_STATUS, OrderStatusService } from './order-status.service';

describe('OrderStatusService', () => {
  it('allows only linear fulfillment progression after payment', () => {
    expect(NEXT_STATUS[OrderStatus.PENDING_PAYMENT]).toBeUndefined();
    expect(NEXT_STATUS[OrderStatus.PAYMENT_FAILED]).toBeUndefined();
    expect(NEXT_STATUS[OrderStatus.CANCELLED]).toBeUndefined();
    expect(NEXT_STATUS[OrderStatus.PAID]).toBe(OrderStatus.PREPARING);
    expect(NEXT_STATUS[OrderStatus.PREPARING]).toBe(OrderStatus.READY);
    expect(NEXT_STATUS[OrderStatus.READY]).toBe(OrderStatus.COMPLETED);
  });

  it('throws 404 when order does not exist', async () => {
    const db = { order: { findUnique: jest.fn().mockResolvedValue(null) } };
    await expect(
      new OrderStatusService(db as never).transition('o', OrderStatus.PREPARING),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws 400 on invalid transition or unpaid order', async () => {
    const db = {
      order: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'o', status: OrderStatus.PENDING_PAYMENT }),
      },
    };
    await expect(
      new OrderStatusService(db as never).transition('o', OrderStatus.PREPARING),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws 409 on stale concurrent transition without overwriting newer state', async () => {
    const db = {
      order: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'o', status: OrderStatus.PAID }),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    await expect(
      new OrderStatusService(db as never).transition('o', OrderStatus.PREPARING),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
