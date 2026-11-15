import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  DiscountType,
  IdempotencyStatus,
  LoyaltyType,
  OrderStatus,
  PaymentDispatchStatus,
  PaymentMethod,
  PaymentStatus,
} from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { OrdersService } from '../orders/orders.service';
import { PricingService } from '../products/pricing.service';
import { ProductsService } from '../products/products.service';
import { PromotionsService } from '../promotions/promotions.service';
import {
  GatewayProbeResult,
  GatewayStatus,
  GatewayTimeoutError,
  PaymentGateway,
} from './gateway/payment-gateway';
import { MockPaymentScenario } from './mock-payment-scenario';
import { PaymentJobs } from './payment.jobs';
import { PaymentsService } from './payments.service';

interface InMemoryState {
  users: Map<string, { id: string }>;
  products: Map<
    string,
    { id: string; stockQuantity: number; isAvailable: boolean }
  >;
  promotions: Map<
    string,
    {
      id: string;
      code: string;
      discountType: DiscountType;
      discountValue: number;
      minOrderAmount: number;
      startsAt: Date;
      endsAt: Date;
      usageLimit: number | null;
      usedCount: number;
      isActive: boolean;
    }
  >;
  orders: Map<
    string,
    {
      id: string;
      userId: string;
      status: OrderStatus;
      subtotal: number;
      discountAmount: number;
      totalAmount: number;
      promotionId: string | null;
      createdAt: Date;
    }
  >;
  orderItems: Array<{
    id: string;
    orderId: string;
    productId: string;
    quantity: number;
  }>;
  payments: Map<
    string,
    {
      id: string;
      orderId: string;
      method: PaymentMethod;
      status: PaymentStatus;
      amount: number;
      idempotencyKey: string;
      gatewayTransactionId: string | null;
      failureReason: string | null;
      scenario: string;
      dispatchStatus: PaymentDispatchStatus;
      attemptCount: number;
      dispatchLeaseUntil: Date | null;
      nextRetryAt: Date | null;
      lastError: string | null;
      createdAt: Date;
      updatedAt: Date;
    }
  >;
  idempotencyKeys: Map<
    string,
    {
      id: string;
      userId: string;
      key: string;
      endpoint: string;
      requestHash: string;
      status: IdempotencyStatus;
      responseStatus: number | null;
      responseBody: unknown;
      createdAt: Date;
      expiresAt: Date;
    }
  >;
  loyaltyTransactions: Array<{
    id: string;
    userId: string;
    orderId: string | null;
    type: LoyaltyType;
    points: number;
    createdAt: Date;
  }>;
}

class InMemoryTransactionalPrisma {
  state: InMemoryState;
  private locks = new Map<string, Promise<void>>();
  private txHooks: Array<{
    matchSql: RegExp;
    onLock?: () => Promise<void>;
  }> = [];

  constructor(initial: Partial<InMemoryState> = {}) {
    this.state = {
      users: initial.users ?? new Map(),
      products: initial.products ?? new Map(),
      promotions: initial.promotions ?? new Map(),
      orders: initial.orders ?? new Map(),
      orderItems: initial.orderItems ?? [],
      payments: initial.payments ?? new Map(),
      idempotencyKeys: initial.idempotencyKeys ?? new Map(),
      loyaltyTransactions: initial.loyaltyTransactions ?? [],
    };
  }

  onLockHook(matchSql: RegExp, onLock: () => Promise<void>) {
    this.txHooks.push({ matchSql, onLock });
  }

  private async acquireRowLock(lockKey: string, held: Map<string, () => void>) {
    if (held.has(lockKey)) {
      return;
    }
    while (true) {
      const existing = this.locks.get(lockKey);
      if (!existing) {
        let release!: () => void;
        const next = new Promise<void>((resolve) => {
          release = resolve;
        });
        this.locks.set(lockKey, next);
        held.set(lockKey, () => {
          if (this.locks.get(lockKey) === next) {
            this.locks.delete(lockKey);
          }
          release();
        });
        return;
      }
      await existing;
    }
  }

  private buildClient(
    backing: InMemoryState,
    heldLocks?: Map<string, () => void>,
    undos?: Array<() => void>,
  ) {
    const client = {
      $executeRaw: async (
        strings: TemplateStringsArray,
        ...values: unknown[]
      ) => {
        const sql = strings.join('?');
        if (/FROM orders/i.test(sql) && values[0]) {
          await this.acquireRowLock(
            `orders:${String(values[0])}`,
            heldLocks!,
          );
        } else if (/FROM payments/i.test(sql) && values[0]) {
          const val = String(values[0]);
          const payment =
            backing.payments.get(val) ??
            [...backing.payments.values()].find((p) => p.idempotencyKey === val);
          const lockId = payment ? payment.id : val;
          await this.acquireRowLock(`payments:${lockId}`, heldLocks!);
        }
        for (const hook of this.txHooks) {
          if (hook.matchSql.test(sql) && hook.onLock) {
            await hook.onLock();
          }
        }
        return 1;
      },
      order: {
        findUnique: async ({
          where,
        }: {
          where: { id: string };
          include?: unknown;
          select?: unknown;
        }) => {
          const order = backing.orders.get(where.id);
          if (!order) {
            return null;
          }
          return {
            ...order,
            items: backing.orderItems.filter((i) => i.orderId === order.id),
            payments: [...backing.payments.values()].filter(
              (p) => p.orderId === order.id,
            ),
          };
        },
        findMany: async ({
          where,
        }: {
          where: {
            status?: OrderStatus;
            createdAt?: { lt?: Date };
            payments?: { none?: { status?: { in?: PaymentStatus[] } } };
          };
        }) => {
          return [...backing.orders.values()].filter((order) => {
            if (where.status && order.status !== where.status) {
              return false;
            }
            if (where.createdAt?.lt && !(order.createdAt < where.createdAt.lt)) {
              return false;
            }
            if (where.payments?.none?.status?.in) {
              const disallowed = where.payments.none.status.in;
              const hasAny = [...backing.payments.values()].some(
                (p) => p.orderId === order.id && disallowed.includes(p.status),
              );
              if (hasAny) {
                return false;
              }
            }
            return true;
          });
        },
        updateMany: async ({
          where,
          data,
        }: {
          where: {
            id: string;
            status?: OrderStatus;
            payments?: { none?: { status?: { in?: PaymentStatus[] } } };
          };
          data: { status: OrderStatus };
        }) => {
          const order = backing.orders.get(where.id);
          if (!order) {
            return { count: 0 };
          }
          if (where.status && order.status !== where.status) {
            return { count: 0 };
          }
          if (where.payments?.none?.status?.in) {
            const disallowed = where.payments.none.status.in;
            const hasAny = [...backing.payments.values()].some(
              (p) => p.orderId === order.id && disallowed.includes(p.status),
            );
            if (hasAny) {
              return { count: 0 };
            }
          }
          const prevStatus = order.status;
          order.status = data.status;
          undos?.push(() => {
            order.status = prevStatus;
          });
          return { count: 1 };
        },
      },
      orderItem: {
        findMany: async ({ where }: { where: { orderId: string } }) =>
          backing.orderItems.filter((i) => i.orderId === where.orderId),
      },
      product: {
        update: async ({
          where,
          data,
        }: {
          where: { id: string };
          data: { stockQuantity: { increment: number } };
        }) => {
          const prod = backing.products.get(where.id)!;
          prod.stockQuantity += data.stockQuantity.increment;
          undos?.push(() => {
            prod.stockQuantity -= data.stockQuantity.increment;
          });
          return { ...prod };
        },
      },
      promotion: {
        updateMany: async ({
          where,
          data,
        }: {
          where: { id: string; usedCount?: { gt: number } };
          data: { usedCount: { decrement: number } };
        }) => {
          const promo = backing.promotions.get(where.id);
          if (!promo) {
            return { count: 0 };
          }
          if (where.usedCount?.gt !== undefined && !(promo.usedCount > where.usedCount.gt)) {
            return { count: 0 };
          }
          promo.usedCount -= data.usedCount.decrement;
          undos?.push(() => {
            promo.usedCount += data.usedCount.decrement;
          });
          return { count: 1 };
        },
      },
      loyaltyTransaction: {
        groupBy: async ({ where }: { where: { userId: string } }) => {
          const earn = backing.loyaltyTransactions
            .filter((t) => t.userId === where.userId && t.type === LoyaltyType.EARN)
            .reduce((acc, t) => acc + t.points, 0);
          const redeem = backing.loyaltyTransactions
            .filter(
              (t) => t.userId === where.userId && t.type === LoyaltyType.REDEEM,
            )
            .reduce((acc, t) => acc + t.points, 0);
          return [
            { type: LoyaltyType.EARN, _sum: { points: earn } },
            { type: LoyaltyType.REDEEM, _sum: { points: redeem } },
          ];
        },
        findFirst: async ({
          where,
        }: {
          where: { orderId?: string; type?: LoyaltyType };
        }) =>
          backing.loyaltyTransactions.find(
            (t) =>
              (where.orderId === undefined || t.orderId === where.orderId) &&
              (where.type === undefined || t.type === where.type),
          ) ?? null,
        create: async ({
          data,
        }: {
          data: {
            userId: string;
            orderId?: string;
            type: LoyaltyType;
            points: number;
          };
        }) => {
          const row = {
            id: randomUUID(),
            userId: data.userId,
            orderId: data.orderId ?? null,
            type: data.type,
            points: data.points,
            createdAt: new Date(),
          };
          backing.loyaltyTransactions.push(row);
          undos?.push(() => {
            backing.loyaltyTransactions = backing.loyaltyTransactions.filter(
              (t) => t.id !== row.id,
            );
          });
          return row;
        },
        deleteMany: async ({
          where,
        }: {
          where: { orderId: string; type: LoyaltyType };
        }) => {
          const removed = backing.loyaltyTransactions.filter(
            (t) => t.orderId === where.orderId && t.type === where.type,
          );
          const before = backing.loyaltyTransactions.length;
          backing.loyaltyTransactions = backing.loyaltyTransactions.filter(
            (t) => !(t.orderId === where.orderId && t.type === where.type),
          );
          if (removed.length > 0) {
            undos?.push(() => {
              backing.loyaltyTransactions.push(...removed);
            });
          }
          return { count: before - backing.loyaltyTransactions.length };
        },
      },
      idempotencyKey: {
        findUnique: async ({
          where,
        }: {
          where: { userId_key: { userId: string; key: string } };
        }) => {
          const row = backing.idempotencyKeys.get(
            `${where.userId_key.userId}:${where.userId_key.key}`,
          );
          return row ? { ...row } : null;
        },
        create: async ({
          data,
        }: {
          data: {
            userId: string;
            key: string;
            endpoint: string;
            requestHash: string;
            expiresAt: Date;
          };
        }) => {
          const mapKey = `${data.userId}:${data.key}`;
          if (backing.idempotencyKeys.has(mapKey)) {
            throw new Error('Duplicate idempotency key');
          }
          const row = {
            id: randomUUID(),
            userId: data.userId,
            key: data.key,
            endpoint: data.endpoint,
            requestHash: data.requestHash,
            status: IdempotencyStatus.IN_PROGRESS,
            responseStatus: null,
            responseBody: null,
            createdAt: new Date(),
            expiresAt: data.expiresAt,
          };
          backing.idempotencyKeys.set(mapKey, row);
          undos?.push(() => {
            backing.idempotencyKeys.delete(mapKey);
          });
          return { ...row };
        },
        updateMany: async ({
          where,
          data,
        }: {
          where: { userId: string; key: string };
          data: {
            status: IdempotencyStatus;
            responseStatus: number;
            responseBody: unknown;
          };
        }) => {
          const mapKey = `${where.userId}:${where.key}`;
          const row = backing.idempotencyKeys.get(mapKey);
          if (!row) {
            return { count: 0 };
          }
          const prev = { ...row };
          Object.assign(row, data);
          undos?.push(() => {
            Object.assign(row, prev);
          });
          return { count: 1 };
        },
        deleteMany: async ({
          where,
        }: {
          where: { status: IdempotencyStatus; expiresAt: { lt: Date } };
        }) => {
          let count = 0;
          const removed: Array<
            [string, InMemoryState['idempotencyKeys'] extends Map<string, infer V> ? V : never]
          > = [];
          for (const [k, v] of backing.idempotencyKeys.entries()) {
            if (v.status === where.status && v.expiresAt < where.expiresAt.lt) {
              removed.push([k, v]);
              backing.idempotencyKeys.delete(k);
              count += 1;
            }
          }
          if (removed.length > 0) {
            undos?.push(() => {
              for (const [k, v] of removed) {
                backing.idempotencyKeys.set(k, v);
              }
            });
          }
          return { count };
        },
      },
      payment: {
        findUnique: async ({
          where,
        }: {
          where: { id?: string; idempotencyKey?: string };
        }) => {
          const row = where.id
            ? backing.payments.get(where.id)
            : [...backing.payments.values()].find(
                (p) => p.idempotencyKey === where.idempotencyKey,
              );
          return row ? { ...row } : null;
        },
        findFirst: async ({
          where,
        }: {
          where: {
            orderId?: string;
            status?: PaymentStatus | { in: PaymentStatus[] };
          };
        }) => {
          const rows = [...backing.payments.values()]
            .filter((p) => {
              if (where.orderId && p.orderId !== where.orderId) {
                return false;
              }
              if (where.status) {
                if (typeof where.status === 'string') {
                  if (p.status !== where.status) return false;
                } else if (!where.status.in.includes(p.status)) {
                  return false;
                }
              }
              return true;
            })
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
          return rows[0] ? { ...rows[0] } : null;
        },
        findMany: async ({
          where,
        }: {
          where: {
            status?: PaymentStatus;
            dispatchStatus?: { in?: PaymentDispatchStatus[] };
            AND?: Array<{ OR: Array<Record<string, unknown>> }>;
          };
        }) => {
          return [...backing.payments.values()]
            .filter((p) => {
              if (where.status && p.status !== where.status) {
                return false;
              }
              if (
                where.dispatchStatus?.in &&
                !where.dispatchStatus.in.includes(p.dispatchStatus)
              ) {
                return false;
              }
              if (where.AND) {
                for (const clause of where.AND) {
                  const matched = clause.OR.some((cond) => {
                    if ('dispatchLeaseUntil' in cond) {
                      const target = cond.dispatchLeaseUntil as
                        | null
                        | { lte: Date };
                      if (target === null) return p.dispatchLeaseUntil === null;
                      return (
                        p.dispatchLeaseUntil !== null &&
                        p.dispatchLeaseUntil <= target.lte
                      );
                    }
                    if ('nextRetryAt' in cond) {
                      const target = cond.nextRetryAt as null | { lte: Date };
                      if (target === null) return p.nextRetryAt === null;
                      return (
                        p.nextRetryAt !== null && p.nextRetryAt <= target.lte
                      );
                    }
                    return false;
                  });
                  if (!matched) return false;
                }
              }
              return true;
            })
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
            .map((p) => ({
              ...p,
              order: backing.orders.get(p.orderId)!,
            }));
        },
        create: async ({
          data,
        }: {
          data: {
            orderId: string;
            method: PaymentMethod;
            amount: number;
            idempotencyKey: string;
            scenario?: string;
            dispatchStatus?: PaymentDispatchStatus;
            attemptCount?: number;
            dispatchLeaseUntil?: Date | null;
          };
        }) => {
          const activeExists = [...backing.payments.values()].some(
            (p) =>
              p.orderId === data.orderId &&
              (p.status === PaymentStatus.PENDING ||
                p.status === PaymentStatus.SUCCESS),
          );
          if (activeExists) {
            throw new Error('Unique constraint on active payment per order');
          }
          const now = new Date();
          const row = {
            id: randomUUID(),
            orderId: data.orderId,
            method: data.method,
            status: PaymentStatus.PENDING,
            amount: data.amount,
            idempotencyKey: data.idempotencyKey,
            gatewayTransactionId: null,
            failureReason: null,
            scenario: data.scenario ?? 'SUCCESS',
            dispatchStatus:
              data.dispatchStatus ?? PaymentDispatchStatus.PENDING_DISPATCH,
            attemptCount: data.attemptCount ?? 0,
            dispatchLeaseUntil: data.dispatchLeaseUntil ?? null,
            nextRetryAt: null,
            lastError: null,
            createdAt: now,
            updatedAt: now,
          };
          backing.payments.set(row.id, row);
          undos?.push(() => {
            backing.payments.delete(row.id);
          });
          return { ...row };
        },
        update: async ({
          where,
          data,
        }: {
          where: { id?: string; idempotencyKey?: string };
          data: Record<string, unknown>;
        }) => {
          const row = where.id
            ? backing.payments.get(where.id)
            : [...backing.payments.values()].find(
                (p) => p.idempotencyKey === where.idempotencyKey,
              );
          if (!row) throw new Error('Payment not found');
          const prev = { ...row };
          for (const [k, v] of Object.entries(data)) {
            if (
              k === 'attemptCount' &&
              typeof v === 'object' &&
              v !== null &&
              'increment' in v
            ) {
              row.attemptCount += (v as { increment: number }).increment;
            } else if (v !== undefined) {
              (row as Record<string, unknown>)[k] = v;
            }
          }
          row.updatedAt = new Date();
          undos?.push(() => {
            Object.assign(row, prev);
          });
          return { ...row };
        },
        updateMany: async ({
          where,
          data,
        }: {
          where: { id: string; status?: PaymentStatus };
          data: Record<string, unknown>;
        }) => {
          const row = backing.payments.get(where.id);
          if (!row) return { count: 0 };
          if (where.status && row.status !== where.status) return { count: 0 };
          const prev = { ...row };
          for (const [k, v] of Object.entries(data)) {
            if (v !== undefined) {
              (row as Record<string, unknown>)[k] = v;
            }
          }
          row.updatedAt = new Date();
          undos?.push(() => {
            Object.assign(row, prev);
          });
          return { count: 1 };
        },
      },
    };
    return client;
  }

  get order() {
    return this.buildClient(this.state).order;
  }
  get orderItem() {
    return this.buildClient(this.state).orderItem;
  }
  get product() {
    return this.buildClient(this.state).product;
  }
  get promotion() {
    return this.buildClient(this.state).promotion;
  }
  get loyaltyTransaction() {
    return this.buildClient(this.state).loyaltyTransaction;
  }
  get idempotencyKey() {
    return this.buildClient(this.state).idempotencyKey;
  }
  get payment() {
    return this.buildClient(this.state).payment;
  }

  async $transaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
    const held = new Map<string, () => void>();
    const undos: Array<() => void> = [];
    const txClient = this.buildClient(this.state, held, undos);
    try {
      return await fn(txClient);
    } catch (error) {
      for (let i = undos.length - 1; i >= 0; i--) {
        undos[i]();
      }
      throw error;
    } finally {
      for (const release of held.values()) {
        release();
      }
    }
  }
}

function createHarness(options?: { expiredOrder?: boolean; withPromo?: boolean }) {
  const userId = randomUUID();
  const productId = randomUUID();
  const orderId = randomUUID();
  const promoId = options?.withPromo ? randomUUID() : null;

  const initial: Partial<InMemoryState> = {
    users: new Map([[userId, { id: userId }]]),
    products: new Map([
      [productId, { id: productId, stockQuantity: 4, isAvailable: true }],
    ]),
    promotions: promoId
      ? new Map([
          [
            promoId,
            {
              id: promoId,
              code: 'SAVE10',
              discountType: DiscountType.FIXED_AMOUNT,
              discountValue: 5000,
              minOrderAmount: 10000,
              startsAt: new Date(Date.now() - 60_000),
              endsAt: new Date(Date.now() + 600_000),
              usageLimit: 5,
              usedCount: 1,
              isActive: true,
            },
          ],
        ])
      : new Map(),
    orders: new Map([
      [
        orderId,
        {
          id: orderId,
          userId,
          status: OrderStatus.PENDING_PAYMENT,
          subtotal: 41000,
          discountAmount: promoId ? 7000 : 0,
          totalAmount: promoId ? 34000 : 41000,
          promotionId: promoId,
          createdAt: options?.expiredOrder
            ? new Date(Date.now() - 20 * 60 * 1000)
            : new Date(),
        },
      ],
    ]),
    orderItems: [
      { id: randomUUID(), orderId, productId, quantity: 2 },
    ],
    loyaltyTransactions: [
      {
        id: randomUUID(),
        userId,
        orderId: null,
        type: LoyaltyType.EARN,
        points: 10,
        createdAt: new Date(Date.now() - 10_000),
      },
      ...(promoId
        ? [
            {
              id: randomUUID(),
              userId,
              orderId,
              type: LoyaltyType.REDEEM,
              points: 2,
              createdAt: new Date(),
            },
          ]
        : []),
    ],
  };

  const prisma = new InMemoryTransactionalPrisma(initial);
  const productsService = new ProductsService(prisma as never);
  const promotionsService = new PromotionsService(prisma as never);
  const loyaltyService = new LoyaltyService(prisma as never);
  const ordersService = new OrdersService(
    prisma as never,
    productsService,
    new PricingService(),
    promotionsService,
    loyaltyService,
  );

  return {
    userId,
    productId,
    orderId,
    promoId,
    prisma,
    ordersService,
    loyaltyService,
  };
}

describe('PaymentsService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      PAYMENT_TIMEOUT_MS: '200',
      PAYMENT_DISPATCH_LEASE_MS: '300',
      PAYMENT_MAX_DISPATCH_ATTEMPTS: '3',
      PAYMENT_RETRY_BASE_MS: '0',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('missing or malformed idempotency key fails with 400 before database or gateway access', async () => {
    const gateway = { charge: jest.fn() };
    const service = new PaymentsService(
      {} as never,
      {} as never,
      gateway as never,
    );

    await expect(
      service.pay('u', undefined, { orderId: 'o', method: 'CARD' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.pay('u', 'not-a-uuid', { orderId: 'o', method: 'CARD' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(gateway.charge).not.toHaveBeenCalled();
  });

  it('completed key replays exact stored response', async () => {
    const response = { status: 'SUCCESS' };
    const service = new PaymentsService({} as never, {} as never, {} as never);
    const result = await service['handleExistingKey'](
      {
        status: IdempotencyStatus.COMPLETED,
        requestHash: 'h',
        responseStatus: 200,
        responseBody: response,
      },
      'h',
    );
    expect(result).toEqual({ statusCode: 200, body: response });
  });

  it('same key with another body is rejected with 422', async () => {
    const service = new PaymentsService({} as never, {} as never, {} as never);
    await expect(
      service['handleExistingKey'](
        {
          status: IdempotencyStatus.COMPLETED,
          requestHash: 'a',
          responseStatus: 200,
          responseBody: {},
        },
        'b',
      ),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('BE-01: serializes pay() and expireStaleOrders() so cancelled order never calls gateway', async () => {
    const { userId, productId, orderId, promoId, prisma, ordersService } =
      createHarness({ expiredOrder: true, withPromo: true });
    let gatewayCharges = 0;
    const gateway: PaymentGateway = {
      charge: async () => {
        gatewayCharges += 1;
        return { status: 'SUCCESS', gatewayTransactionId: 'gw-1' };
      },
      getStatus: async () => 'NOT_FOUND',
    };

    const paymentsService = new PaymentsService(
      prisma as never,
      ordersService,
      gateway,
    );
    const jobs = new PaymentJobs(
      prisma as never,
      new ProductsService(prisma as never),
      paymentsService,
      ordersService,
    );

    // Pause expire inside the locked order transaction, then launch pay() concurrently
    let expireLockedResolve!: () => void;
    const expireLocked = new Promise<void>((r) => {
      expireLockedResolve = r;
    });
    let releaseExpire!: () => void;
    const gateExpire = new Promise<void>((r) => {
      releaseExpire = r;
    });
    let firstHook = true;
    prisma.onLockHook(/FROM orders/i, async () => {
      if (firstHook) {
        firstHook = false;
        expireLockedResolve();
        await gateExpire;
      }
    });

    const expirePromise = jobs.expireStaleOrders();
    await expireLocked;
    const payPromise = paymentsService.pay(userId, randomUUID(), {
      orderId,
      method: PaymentMethod.WALLET,
    });
    releaseExpire();

    const cancelled = await expirePromise;
    await expect(payPromise).rejects.toBeInstanceOf(ConflictException);

    expect(cancelled).toBe(1);
    expect(gatewayCharges).toBe(0);
    expect(prisma.state.orders.get(orderId)!.status).toBe(
      OrderStatus.CANCELLED,
    );
    expect(prisma.state.products.get(productId)!.stockQuantity).toBe(6);
    expect(prisma.state.promotions.get(promoId!)!.usedCount).toBe(0);
  });

  it('BE-01: when pay() wins the order lock first, expireStaleOrders() does not cancel or release stock', async () => {
    const { userId, productId, orderId, promoId, prisma, ordersService } =
      createHarness({ expiredOrder: true, withPromo: true });
    let gatewayCharges = 0;
    let chargeEnteredResolve!: () => void;
    const chargeEntered = new Promise<void>((r) => {
      chargeEnteredResolve = r;
    });
    let releaseCharge!: () => void;
    const gateCharge = new Promise<void>((r) => {
      releaseCharge = r;
    });

    const gateway: PaymentGateway = {
      charge: async () => {
        gatewayCharges += 1;
        chargeEnteredResolve();
        await gateCharge;
        return { status: 'SUCCESS', gatewayTransactionId: 'gw-win' };
      },
      getStatus: async () => 'NOT_FOUND',
    };

    const paymentsService = new PaymentsService(
      prisma as never,
      ordersService,
      gateway,
    );
    const jobs = new PaymentJobs(
      prisma as never,
      new ProductsService(prisma as never),
      paymentsService,
      ordersService,
    );

    const payPromise = paymentsService.pay(userId, randomUUID(), {
      orderId,
      method: PaymentMethod.WALLET,
    });
    await chargeEntered;

    const cancelled = await jobs.expireStaleOrders();
    expect(cancelled).toBe(0);

    releaseCharge();
    const res = await payPromise;
    expect(res.statusCode).toBe(HttpStatus.OK);
    expect(gatewayCharges).toBe(1);
    expect(prisma.state.orders.get(orderId)!.status).toBe(OrderStatus.PAID);
    expect(prisma.state.products.get(productId)!.stockQuantity).toBe(4);
    expect(prisma.state.promotions.get(promoId!)!.usedCount).toBe(1);
  });

  it('BE-02: recovers a payment interrupted after commit before reaching gateway and avoids duplicate charge on retry', async () => {
    const { userId, orderId, prisma, ordersService } = createHarness();
    const key = randomUUID();
    const gatewayTxs = new Map<
      string,
      { status: 'SUCCESS' | 'FAILED'; gatewayTransactionId: string }
    >();
    let gatewayCharges = 0;
    const gateway: PaymentGateway = {
      charge: async (req) => {
        gatewayCharges += 1;
        const tx = {
          status: 'SUCCESS' as const,
          gatewayTransactionId: `gw-${gatewayCharges}`,
        };
        gatewayTxs.set(req.idempotencyKey, tx);
        return tx;
      },
      getStatus: async (k): Promise<GatewayStatus> =>
        gatewayTxs.get(k)?.status ?? 'NOT_FOUND',
      getTransaction: async (k): Promise<GatewayProbeResult> =>
        gatewayTxs.get(k) ?? { status: 'NOT_FOUND' },
    };

    // Simulate process crash right after T_pay commit (before gateway.charge was ever called)
    const paymentId = randomUUID();
    const requestHash = createHash('sha256')
      .update(JSON.stringify({ orderId, method: PaymentMethod.WALLET }))
      .digest('hex');
    prisma.state.idempotencyKeys.set(`${userId}:${key}`, {
      id: randomUUID(),
      userId,
      key,
      endpoint: 'POST /payments',
      requestHash,
      status: IdempotencyStatus.IN_PROGRESS,
      responseStatus: null,
      responseBody: null,
      createdAt: new Date(Date.now() - 2000),
      expiresAt: new Date(Date.now() + 60_000),
    });
    prisma.state.payments.set(paymentId, {
      id: paymentId,
      orderId,
      method: PaymentMethod.WALLET,
      status: PaymentStatus.PENDING,
      amount: 41000,
      idempotencyKey: key,
      gatewayTransactionId: null,
      failureReason: null,
      scenario: MockPaymentScenario.SUCCESS,
      dispatchStatus: PaymentDispatchStatus.DISPATCHING,
      attemptCount: 1,
      dispatchLeaseUntil: new Date(Date.now() - 500), // expired lease from crashed worker
      nextRetryAt: null,
      lastError: null,
      createdAt: new Date(Date.now() - 2000),
      updatedAt: new Date(Date.now() - 2000),
    });

    const paymentsService = new PaymentsService(
      prisma as never,
      ordersService,
      gateway,
    );
    const jobs = new PaymentJobs(
      prisma as never,
      new ProductsService(prisma as never),
      paymentsService,
      ordersService,
    );

    const recovered = await jobs.recoverPendingPayments();
    expect(recovered).toBe(1);
    expect(gatewayCharges).toBe(1);
    expect(prisma.state.orders.get(orderId)!.status).toBe(OrderStatus.PAID);
    expect(prisma.state.payments.get(paymentId)!.status).toBe(
      PaymentStatus.SUCCESS,
    );
    expect(prisma.state.payments.get(paymentId)!.dispatchStatus).toBe(
      PaymentDispatchStatus.COMPLETED,
    );
    expect(prisma.state.idempotencyKeys.get(`${userId}:${key}`)!.status).toBe(
      IdempotencyStatus.COMPLETED,
    );

    // Subsequent client retry with same key replays without another gateway charge
    const retry = await paymentsService.pay(userId, key, {
      orderId,
      method: PaymentMethod.WALLET,
    });
    expect(retry.statusCode).toBe(HttpStatus.OK);
    expect(gatewayCharges).toBe(1);
  });

  it('BE-02: allows safe client retry with same key after transient gateway failure and escalates to NEEDS_INTERVENTION when unrecoverable', async () => {
    const { userId, productId, orderId, promoId, prisma, ordersService } =
      createHarness({ withPromo: true });
    const key = randomUUID();
    let failGateway = true;
    let gatewayCharges = 0;
    const gatewayTxs = new Map<
      string,
      { status: 'SUCCESS'; gatewayTransactionId: string }
    >();
    const gateway: PaymentGateway = {
      charge: async (req) => {
        gatewayCharges += 1;
        if (failGateway) {
          throw new Error('Gateway socket reset');
        }
        const tx = {
          status: 'SUCCESS' as const,
          gatewayTransactionId: 'gw-recovered',
        };
        gatewayTxs.set(req.idempotencyKey, tx);
        return tx;
      },
      getStatus: async (k) => gatewayTxs.get(k)?.status ?? 'NOT_FOUND',
      getTransaction: async (k) => gatewayTxs.get(k) ?? { status: 'NOT_FOUND' },
    };

    const paymentsService = new PaymentsService(
      prisma as never,
      ordersService,
      gateway,
    );

    // First attempt fails transiently before gateway records transaction
    await expect(
      paymentsService.pay(userId, key, {
        orderId,
        method: PaymentMethod.CARD,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    // Gateway comes back; client retries with the same Idempotency-Key
    failGateway = false;
    const retryRes = await paymentsService.pay(userId, key, {
      orderId,
      method: PaymentMethod.CARD,
    });
    expect(retryRes.statusCode).toBe(HttpStatus.OK);
    expect(retryRes.body.status).toBe('SUCCESS');
    expect(gatewayCharges).toBe(2);
    expect(prisma.state.orders.get(orderId)!.status).toBe(OrderStatus.PAID);

    // Now test unrecoverable gateway errors -> transitions to NEEDS_INTERVENTION + alert without releasing stock
    const harness2 = createHarness({ withPromo: true });
    const key2 = randomUUID();
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    try {
      const alwaysFailingGateway: PaymentGateway = {
        charge: async () => {
          throw new Error('Upstream down');
        },
        getStatus: async () => 'NOT_FOUND',
      };
      const svc2 = new PaymentsService(
        harness2.prisma as never,
        harness2.ordersService,
        alwaysFailingGateway,
      );

      // Attempt 1 via pay()
      await expect(
        svc2.pay(harness2.userId, key2, {
          orderId: harness2.orderId,
          method: PaymentMethod.WALLET,
        }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);

      // Attempt 2 via reconcile()
      const rec1 = await svc2.reconcile(harness2.userId, harness2.orderId);
      expect(rec1.statusCode).toBe(HttpStatus.ACCEPTED);

      // Attempt 3 via reconcile() -> hits max attempts -> NEEDS_INTERVENTION (503) + alert
      const rec2 = await svc2.reconcile(harness2.userId, harness2.orderId);
      expect(rec2.statusCode).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      expect(rec2.body.status).toBe('NEEDS_INTERVENTION');

      // Subsequent reconcile() also surfaces NEEDS_INTERVENTION (not stuck at 202)
      const rec3 = await svc2.reconcile(harness2.userId, harness2.orderId);
      expect(rec3.statusCode).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      expect(rec3.body.status).toBe('NEEDS_INTERVENTION');

      // Resources must NOT be auto-released without gateway failure confirmation
      expect(harness2.prisma.state.orders.get(harness2.orderId)!.status).toBe(
        OrderStatus.PENDING_PAYMENT,
      );
      expect(
        harness2.prisma.state.products.get(harness2.productId)!.stockQuantity,
      ).toBe(4);
      expect(
        harness2.prisma.state.promotions.get(harness2.promoId!)!.usedCount,
      ).toBe(1);
      expect(errorSpy).toHaveBeenCalled();
    } finally {
      errorSpy.mockRestore();
    }

    // Unused destructured variables from first sub-test sanity
    expect(prisma.state.products.get(productId)!.stockQuantity).toBe(4);
    expect(prisma.state.promotions.get(promoId!)!.usedCount).toBe(1);
  });

  it('BE-02: timeout does not release stock and settles PAID if gateway later confirms SUCCESS', async () => {
    const { userId, productId, orderId, promoId, prisma, ordersService } =
      createHarness({ withPromo: true });
    const key = randomUUID();
    let gatewayConfirmed = false;
    const gateway: PaymentGateway = {
      charge: async () => {
        gatewayConfirmed = true;
        throw new GatewayTimeoutError();
      },
      getStatus: async () => (gatewayConfirmed ? 'SUCCESS' : 'NOT_FOUND'),
      getTransaction: async () =>
        gatewayConfirmed
          ? { status: 'SUCCESS', gatewayTransactionId: 'gw-late-success' }
          : { status: 'NOT_FOUND' },
    };

    const service = new PaymentsService(
      prisma as never,
      ordersService,
      gateway,
    );
    const payRes = await service.pay(userId, key, {
      orderId,
      method: PaymentMethod.WALLET,
      scenario: MockPaymentScenario.TIMEOUT_CHARGED,
    });
    expect(payRes.statusCode).toBe(HttpStatus.ACCEPTED);
    expect(prisma.state.orders.get(orderId)!.status).toBe(
      OrderStatus.PENDING_PAYMENT,
    );
    expect(prisma.state.products.get(productId)!.stockQuantity).toBe(4);
    expect(prisma.state.promotions.get(promoId!)!.usedCount).toBe(1);

    const rec = await service.reconcile(userId, orderId);
    expect(rec.statusCode).toBe(HttpStatus.OK);
    expect(rec.body.status).toBe('SUCCESS');
    expect(prisma.state.orders.get(orderId)!.status).toBe(OrderStatus.PAID);
  });

  it('BE-03: concurrent reconcile() on SUCCESS returns [200, 200] with single loyalty earn and protects advanced orders', async () => {
    const { userId, orderId, prisma, ordersService, loyaltyService } =
      createHarness();
    const key = randomUUID();
    const paymentId = randomUUID();
    prisma.state.idempotencyKeys.set(`${userId}:${key}`, {
      id: randomUUID(),
      userId,
      key,
      endpoint: 'POST /payments',
      requestHash: 'hash',
      status: IdempotencyStatus.IN_PROGRESS,
      responseStatus: null,
      responseBody: null,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });
    prisma.state.payments.set(paymentId, {
      id: paymentId,
      orderId,
      method: PaymentMethod.WALLET,
      status: PaymentStatus.PENDING,
      amount: 41000,
      idempotencyKey: key,
      gatewayTransactionId: null,
      failureReason: null,
      scenario: MockPaymentScenario.TIMEOUT_CHARGED,
      dispatchStatus: PaymentDispatchStatus.AWAITING_GATEWAY,
      attemptCount: 1,
      dispatchLeaseUntil: null,
      nextRetryAt: null,
      lastError: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Synchronize two concurrent getStatus/getTransaction calls so both enter completePayment
    let barrierCount = 0;
    let releaseBarrier!: () => void;
    const barrier = new Promise<void>((r) => {
      releaseBarrier = r;
    });
    const gateway: PaymentGateway = {
      charge: async () => ({
        status: 'SUCCESS',
        gatewayTransactionId: 'gw-1',
      }),
      getStatus: async () => 'SUCCESS',
      getTransaction: async () => {
        barrierCount += 1;
        if (barrierCount === 2) {
          releaseBarrier();
        }
        await barrier;
        return { status: 'SUCCESS', gatewayTransactionId: 'gw-1' };
      },
    };

    const service = new PaymentsService(
      prisma as never,
      ordersService,
      gateway,
    );
    const [r1, r2] = await Promise.all([
      service.reconcile(userId, orderId),
      service.reconcile(userId, orderId),
    ]);

    expect([r1.statusCode, r2.statusCode]).toEqual([200, 200]);
    expect(prisma.state.orders.get(orderId)!.status).toBe(OrderStatus.PAID);
    const earnRows = prisma.state.loyaltyTransactions.filter(
      (t) => t.orderId === orderId && t.type === LoyaltyType.EARN,
    );
    expect(earnRows).toHaveLength(1);
    expect(await loyaltyService.getBalance(prisma as never, userId)).toBe(14);

    // Simulate staff moving order forward to PREPARING / READY / COMPLETED, then late completePayment
    prisma.state.orders.get(orderId)!.status = OrderStatus.PREPARING;
    const late = await service['completePayment'](userId, orderId, key, {
      status: 'SUCCESS',
      gatewayTransactionId: 'gw-1',
    });
    expect(late.statusCode).toBe(HttpStatus.OK);
    expect(prisma.state.orders.get(orderId)!.status).toBe(
      OrderStatus.PREPARING,
    );

    // Conflicting outcome still raises ConflictException
    await expect(
      service['completePayment'](userId, orderId, key, {
        status: 'FAILED',
        failureReason: 'conflict',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('BE-03: concurrent reconcile() on FAILED releases stock, promo, and redeemed points strictly once', async () => {
    const {
      userId,
      productId,
      orderId,
      promoId,
      prisma,
      ordersService,
      loyaltyService,
    } = createHarness({ withPromo: true });
    const key = randomUUID();
    const paymentId = randomUUID();
    prisma.state.idempotencyKeys.set(`${userId}:${key}`, {
      id: randomUUID(),
      userId,
      key,
      endpoint: 'POST /payments',
      requestHash: 'hash',
      status: IdempotencyStatus.IN_PROGRESS,
      responseStatus: null,
      responseBody: null,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    });
    prisma.state.payments.set(paymentId, {
      id: paymentId,
      orderId,
      method: PaymentMethod.CARD,
      status: PaymentStatus.PENDING,
      amount: 34000,
      idempotencyKey: key,
      gatewayTransactionId: null,
      failureReason: null,
      scenario: MockPaymentScenario.TIMEOUT_NOT_CHARGED,
      dispatchStatus: PaymentDispatchStatus.AWAITING_GATEWAY,
      attemptCount: 1,
      dispatchLeaseUntil: null,
      nextRetryAt: null,
      lastError: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    let barrierCount = 0;
    let releaseBarrier!: () => void;
    const barrier = new Promise<void>((r) => {
      releaseBarrier = r;
    });
    const gateway: PaymentGateway = {
      charge: async () => ({
        status: 'FAILED',
        gatewayTransactionId: 'gw-fail',
        failureReason: 'Mock payment declined',
      }),
      getStatus: async () => 'FAILED',
      getTransaction: async () => {
        barrierCount += 1;
        if (barrierCount === 2) {
          releaseBarrier();
        }
        await barrier;
        return {
          status: 'FAILED',
          gatewayTransactionId: 'gw-fail',
          failureReason: 'Mock payment declined',
        };
      },
    };

    const service = new PaymentsService(
      prisma as never,
      ordersService,
      gateway,
    );
    const [r1, r2] = await Promise.all([
      service.reconcile(userId, orderId),
      service.reconcile(userId, orderId),
    ]);

    expect([r1.statusCode, r2.statusCode]).toEqual([402, 402]);
    expect(prisma.state.orders.get(orderId)!.status).toBe(
      OrderStatus.PAYMENT_FAILED,
    );
    expect(prisma.state.products.get(productId)!.stockQuantity).toBe(6);
    expect(prisma.state.promotions.get(promoId!)!.usedCount).toBe(0);
    expect(await loyaltyService.getBalance(prisma as never, userId)).toBe(10);
  });

  it('BE-02/BE-03: rejects concurrent active-lease retry with 409 IDEMPOTENCY_IN_PROGRESS and settles concurrent pay() + reconcile() as [200, 200]', async () => {
    const { userId, orderId, prisma, ordersService, loyaltyService } =
      createHarness();
    const key = randomUUID();

    let chargeEnteredResolve!: () => void;
    const chargeEntered = new Promise<void>((r) => {
      chargeEnteredResolve = r;
    });
    let releaseCharge!: () => void;
    const gateCharge = new Promise<void>((r) => {
      releaseCharge = r;
    });
    let gatewayCharged = false;

    const gateway: PaymentGateway = {
      charge: async () => {
        chargeEnteredResolve();
        await gateCharge;
        gatewayCharged = true;
        return { status: 'SUCCESS', gatewayTransactionId: 'gw-race' };
      },
      getStatus: async () => (gatewayCharged ? 'SUCCESS' : 'NOT_FOUND'),
      getTransaction: async () =>
        gatewayCharged
          ? { status: 'SUCCESS', gatewayTransactionId: 'gw-race' }
          : { status: 'NOT_FOUND' },
    };

    const service = new PaymentsService(
      prisma as never,
      ordersService,
      gateway,
    );

    const payPromise = service.pay(userId, key, {
      orderId,
      method: PaymentMethod.WALLET,
    });
    await chargeEntered;

    // Active lease held by in-flight pay(): concurrent duplicate pay() must return 409 IDEMPOTENCY_IN_PROGRESS
    const inFlightRes = await service.pay(userId, key, {
      orderId,
      method: PaymentMethod.WALLET,
    });
    expect(inFlightRes).toMatchObject({
      statusCode: HttpStatus.CONFLICT,
      headers: { 'Retry-After': '2' },
      body: { code: 'IDEMPOTENCY_IN_PROGRESS' },
    });

    // Now gateway has recorded SUCCESS and pay() resumes into completePayment concurrently with reconcile()
    gatewayCharged = true;
    const reconcilePromise = service.reconcile(userId, orderId);
    releaseCharge();

    const [payRes, recRes] = await Promise.all([payPromise, reconcilePromise]);
    expect([payRes.statusCode, recRes.statusCode]).toEqual([200, 200]);
    expect(prisma.state.orders.get(orderId)!.status).toBe(OrderStatus.PAID);
    const earnRows = prisma.state.loyaltyTransactions.filter(
      (t) => t.orderId === orderId && t.type === LoyaltyType.EARN,
    );
    expect(earnRows).toHaveLength(1);
    expect(await loyaltyService.getBalance(prisma as never, userId)).toBe(14);
  });
});
