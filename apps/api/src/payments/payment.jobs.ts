import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { OrderStatus, PaymentStatus } from '@prisma/client';
import { OrdersService } from '../orders/orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from './payments.service';

const ORDER_EXPIRATION_MS = 15 * 60 * 1000;

@Injectable()
export class PaymentJobs implements OnApplicationBootstrap {
  private busy = false;
  private readonly log = new Logger(PaymentJobs.name);

  constructor(
    private readonly db: PrismaService,
    private readonly payments: PaymentsService,
    private readonly orders: OrdersService,
  ) {}

  onApplicationBootstrap(): void {
    if (process.env.NODE_ENV === 'test') {
      return;
    }
    setImmediate(() => {
      void this.run();
    });
  }

  @Interval(30000)
  async run(options?: { force?: boolean }): Promise<void> {
    if ((!options?.force && process.env.NODE_ENV === 'test') || this.busy) {
      return;
    }

    this.busy = true;
    try {
      await this.recoverPendingPayments();
      await this.expireStaleOrders();
      await this.db.idempotencyKey.deleteMany({
        where: { status: 'COMPLETED', expiresAt: { lt: new Date() } },
      });
    } catch {
      this.log.error({ event: 'payment_jobs_failed' });
    } finally {
      this.busy = false;
    }
  }

  async recoverPendingPayments(now = new Date()): Promise<number> {
    if (typeof this.payments.recoverPendingPayments === 'function') {
      return this.payments.recoverPendingPayments(now);
    }

    const pending = await this.db.payment.findMany({
      where: { status: PaymentStatus.PENDING },
      take: 100,
      include: { order: true },
    });
    let recovered = 0;
    for (const payment of pending) {
      try {
        await this.payments.reconcile(payment.order.userId, payment.orderId);
        recovered += 1;
      } catch {
        this.log.warn({ event: 'reconcile_retry', orderId: payment.orderId });
      }
    }
    return recovered;
  }

  async expireStaleOrders(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - ORDER_EXPIRATION_MS);
    const expired = await this.db.order.findMany({
      where: {
        status: OrderStatus.PENDING_PAYMENT,
        createdAt: { lt: cutoff },
        payments: {
          none: {
            status: { in: [PaymentStatus.PENDING, PaymentStatus.SUCCESS] },
          },
        },
      },
      take: 100,
    });

    let cancelledCount = 0;
    for (const order of expired) {
      const cancelled = await this.db.$transaction(async (tx) => {
        if (typeof tx.$executeRaw === 'function') {
          await tx.$executeRaw`
            SELECT id FROM orders WHERE id = ${order.id}::uuid FOR UPDATE
          `;
        }

        const currentOrder = await tx.order.findUnique({
          where: { id: order.id },
          select: {
            id: true,
            status: true,
            promotionId: true,
            createdAt: true,
          },
        });
        if (
          !currentOrder ||
          currentOrder.status !== OrderStatus.PENDING_PAYMENT ||
          currentOrder.createdAt >= cutoff
        ) {
          return false;
        }

        if (tx.payment?.findFirst) {
          const activePayment = await tx.payment.findFirst({
            where: {
              orderId: order.id,
              status: { in: [PaymentStatus.PENDING, PaymentStatus.SUCCESS] },
            },
            select: { id: true },
          });
          if (activePayment) {
            return false;
          }
        }

        const changed = await tx.order.updateMany({
          where: {
            id: order.id,
            status: OrderStatus.PENDING_PAYMENT,
            payments: {
              none: {
                status: { in: [PaymentStatus.PENDING, PaymentStatus.SUCCESS] },
              },
            },
          },
          data: { status: OrderStatus.CANCELLED },
        });
        if (changed.count !== 1) {
          return false;
        }

        await this.orders.releaseOrderAdjustments(
          order.id,
          currentOrder.promotionId,
          tx,
        );
        return true;
      });
      if (cancelled) {
        cancelledCount += 1;
      }
    }
    return cancelledCount;
  }
}
