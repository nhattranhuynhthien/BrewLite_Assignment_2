import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsService } from '../products/products.service';
import { PaymentsService } from './payments.service';

@Injectable()
export class PaymentJobs {
  private busy = false;
  private readonly log = new Logger(PaymentJobs.name);

  constructor(
    private readonly db: PrismaService,
    private readonly products: ProductsService,
    private readonly payments: PaymentsService,
  ) {}

  @Interval(30000)
  async run(): Promise<void> {
    if (process.env.NODE_ENV === 'test' || this.busy) {
      return;
    }

    this.busy = true;
    try {
      const pending = await this.db.payment.findMany({
        where: { status: 'PENDING' },
        take: 100,
        include: { order: true },
      });
      for (const payment of pending) {
        try {
          await this.payments.reconcile(payment.order.userId, payment.orderId);
        } catch {
          this.log.warn({ event: 'reconcile_retry', orderId: payment.orderId });
        }
      }

      const cutoff = new Date(Date.now() - 15 * 60 * 1000);
      const expired = await this.db.order.findMany({
        where: {
          status: 'PENDING_PAYMENT',
          createdAt: { lt: cutoff },
          payments: { none: { status: { in: ['PENDING', 'SUCCESS'] } } },
        },
        take: 100,
      });

      for (const order of expired) {
        await this.db.$transaction(async (tx) => {
          const changed = await tx.order.updateMany({
            where: {
              id: order.id,
              status: 'PENDING_PAYMENT',
              payments: { none: { status: { in: ['PENDING', 'SUCCESS'] } } },
            },
            data: { status: 'CANCELLED' },
          });
          if (changed.count === 1) {
            const items = await tx.orderItem.findMany({
              where: { orderId: order.id },
              select: { productId: true, quantity: true },
            });
            await this.products.restoreStock(items, tx);
          }
        });
      }

      await this.db.idempotencyKey.deleteMany({
        where: { status: 'COMPLETED', expiresAt: { lt: new Date() } },
      });
    } catch {
      this.log.error({ event: 'payment_jobs_failed' });
    } finally {
      this.busy = false;
    }
  }
}
