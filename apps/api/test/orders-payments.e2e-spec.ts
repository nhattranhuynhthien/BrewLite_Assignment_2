import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import {
  DiscountType,
  IdempotencyStatus,
  LoyaltyType,
  OrderStatus,
  PaymentDispatchStatus,
  PaymentMethod,
  PaymentStatus,
  UserRole,
} from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { createAppValidationPipe } from '../src/common/validation/app-validation.pipe';
import { PaymentJobs } from '../src/payments/payment.jobs';
import { PrismaService } from '../src/prisma/prisma.service';

describe('BrewLite Order, Payment & Fulfillment Flow (PostgreSQL)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let paymentJobs: PaymentJobs;
  let usedKeys: string[] = [];
  let usedPromoIds: string[] = [];
  let fixture: {
    userId: string;
    otherUserId: string;
    staffUserId: string;
    token: string;
    otherToken: string;
    staffToken: string;
    categoryId: string;
    productId: string;
    sizeId: string;
    toppingId: string;
    initialStock: number;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(createAppValidationPipe());
    await app.init();
    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);
    paymentJobs = app.get(PaymentJobs);
  });

  beforeEach(async () => {
    usedKeys = [];
    const user = await prisma.user.create({
      data: {
        email: `${randomUUID()}@integration.test`,
        fullName: 'Integration Customer',
        passwordHash: 'not-used-by-fixture-jwt',
        role: UserRole.CUSTOMER,
      },
    });
    const otherUser = await prisma.user.create({
      data: {
        email: `${randomUUID()}@integration.test`,
        fullName: 'Other Customer',
        passwordHash: 'not-used-by-fixture-jwt',
        role: UserRole.CUSTOMER,
      },
    });
    const staffUser = await prisma.user.create({
      data: {
        email: `${randomUUID()}@integration.test`,
        fullName: 'Integration Staff',
        passwordHash: 'not-used-by-fixture-jwt',
        role: UserRole.STAFF,
      },
    });
    const category = await prisma.category.create({
      data: { name: `Category ${randomUUID()}` },
    });
    const topping = await prisma.topping.create({
      data: { name: `Topping ${randomUUID()}`, extraPrice: 6000 },
    });
    const product = await prisma.product.create({
      data: {
        categoryId: category.id,
        name: `Cà phê tích hợp ${randomUUID()}`,
        basePrice: 30000,
        stockQuantity: 5,
      },
    });
    const size = await prisma.size.create({
      data: { productId: product.id, name: 'M', extraPrice: 5000 },
    });
    await prisma.productTopping.create({
      data: { productId: product.id, toppingId: topping.id },
    });

    fixture = {
      userId: user.id,
      otherUserId: otherUser.id,
      staffUserId: staffUser.id,
      token: jwtService.sign({ sub: user.id, role: user.role }),
      otherToken: jwtService.sign({ sub: otherUser.id, role: otherUser.role }),
      staffToken: jwtService.sign({ sub: staffUser.id, role: staffUser.role }),
      categoryId: category.id,
      productId: product.id,
      sizeId: size.id,
      toppingId: topping.id,
      initialStock: 5,
    };
  });

  afterEach(async () => {
    const userIds = [fixture.userId, fixture.otherUserId, fixture.staffUserId];
    if (usedKeys.length > 0) {
      await prisma.mockGatewayTransaction.deleteMany({
        where: { idempotencyKey: { in: usedKeys } },
      });
    }
    await prisma.loyaltyTransaction.deleteMany({
      where: { userId: { in: userIds } },
    });
    await prisma.payment.deleteMany({
      where: { order: { userId: { in: userIds } } },
    });
    await prisma.order.deleteMany({ where: { userId: { in: userIds } } });
    if (usedPromoIds.length > 0) {
      await prisma.promotion.deleteMany({
        where: { id: { in: usedPromoIds } },
      });
      usedPromoIds = [];
    }
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.productTopping.deleteMany({
      where: { productId: fixture.productId },
    });
    await prisma.size.deleteMany({ where: { productId: fixture.productId } });
    await prisma.product.delete({ where: { id: fixture.productId } });
    await prisma.topping.delete({ where: { id: fixture.toppingId } });
    await prisma.category.delete({ where: { id: fixture.categoryId } });
  });

  afterAll(async () => {
    await app.close();
  });

  function orderPayload(quantity = 2) {
    return {
      items: [
        {
          productId: fixture.productId,
          sizeId: fixture.sizeId,
          toppingIds: [fixture.toppingId],
          quantity,
        },
      ],
    };
  }

  function authHeader(token = fixture.token) {
    return `Bearer ${token}`;
  }

  it('returns 200 on health readiness & liveness with real PostgreSQL', async () => {
    const live = await request(app.getHttpServer()).get('/health/live');
    const ready = await request(app.getHttpServer()).get('/health');

    expect(live.status).toBe(200);
    expect(ready.status).toBe(200);
    expect(ready.body.status).toBe('ok');
    expect(ready.body.database).toBe('up');
  });

  it('registers, logs in, and browses catalog with accent-insensitive search', async () => {
    const email = `e2e-${randomUUID()}@brewlite.local`;
    const reg = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'Coffee123!', fullName: 'Khách Tích Hợp' });
    expect(reg.status).toBe(201);

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'Coffee123!' });
    expect(login.status).toBe(200);
    expect(typeof login.body.accessToken).toBe('string');

    const listed = await request(app.getHttpServer())
      .get('/products')
      .query({ q: 'ca phe tich hop' });
    expect(listed.status).toBe(200);
    expect(
      listed.body.items.some((item: { id: string }) => item.id === fixture.productId),
    ).toBe(true);

    const detail = await request(app.getHttpServer()).get(
      `/products/${fixture.productId}`,
    );
    expect(detail.status).toBe(200);
    expect(detail.body.sizes).toHaveLength(1);
    expect(detail.body.toppings).toHaveLength(1);

    await prisma.user.delete({ where: { id: reg.body.id } });
  });

  it('rejects missing/invalid Idempotency-Key with 400 and enforces 403 ownership isolation', async () => {
    const created = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', authHeader())
      .send(orderPayload(1));
    expect(created.status).toBe(201);

    const missingKey = await request(app.getHttpServer())
      .post('/payments')
      .set('Authorization', authHeader())
      .send({ orderId: created.body.id, method: PaymentMethod.WALLET });
    expect(missingKey.status).toBe(400);

    const otherView = await request(app.getHttpServer())
      .get(`/orders/${created.body.id}`)
      .set('Authorization', authHeader(fixture.otherToken));
    expect(otherView.status).toBe(403);
  });

  it('creates an order with server-side pricing, charges once, and replays idempotent payment', async () => {
    const created = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', authHeader())
      .send(orderPayload(2));

    expect(created.status).toBe(201);
    expect(created.body.status).toBe(OrderStatus.PENDING_PAYMENT);
    expect(created.body.totalAmount).toBe(82000);
    expect(created.body.items[0].unitPrice).toBe(41000);

    const key = randomUUID();
    usedKeys.push(key);
    const paymentPayload = {
      orderId: created.body.id,
      method: PaymentMethod.WALLET,
      scenario: 'SUCCESS',
    };

    const first = await request(app.getHttpServer())
      .post('/payments')
      .set('Authorization', authHeader())
      .set('Idempotency-Key', key)
      .send(paymentPayload);
    const replay = await request(app.getHttpServer())
      .post('/payments')
      .set('Authorization', authHeader())
      .set('Idempotency-Key', key)
      .send(paymentPayload);

    expect(first.status).toBe(200);
    expect(replay.status).toBe(200);
    expect(replay.body).toEqual(first.body);
    expect(await prisma.payment.count({ where: { orderId: created.body.id } })).toBe(
      1,
    );
    expect(
      (
        await prisma.order.findUniqueOrThrow({
          where: { id: created.body.id },
        })
      ).status,
    ).toBe(OrderStatus.PAID);
  });

  it('restores reserved stock when a charge is declined', async () => {
    const created = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', authHeader())
      .send(orderPayload(1));
    const key = randomUUID();
    usedKeys.push(key);

    const payment = await request(app.getHttpServer())
      .post('/payments')
      .set('Authorization', authHeader())
      .set('Idempotency-Key', key)
      .send({
        orderId: created.body.id,
        method: PaymentMethod.CARD,
        scenario: 'DECLINED',
      });

    expect(payment.status).toBe(402);
    expect(payment.body.status).toBe('FAILED');
    expect(
      (
        await prisma.order.findUniqueOrThrow({
          where: { id: created.body.id },
        })
      ).status,
    ).toBe(OrderStatus.PAYMENT_FAILED);
    expect(
      (
        await prisma.product.findUniqueOrThrow({
          where: { id: fixture.productId },
        })
      ).stockQuantity,
    ).toBe(fixture.initialStock);
  });

  it('reconciles a charged gateway timeout without charging twice', async () => {
    const created = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', authHeader())
      .send(orderPayload(1));
    const key = randomUUID();
    usedKeys.push(key);

    const pending = await request(app.getHttpServer())
      .post('/payments')
      .set('Authorization', authHeader())
      .set('Idempotency-Key', key)
      .send({
        orderId: created.body.id,
        method: PaymentMethod.WALLET,
        scenario: 'TIMEOUT_CHARGED',
      });
    const reconciled = await request(app.getHttpServer())
      .get(`/payments/${created.body.id}/status`)
      .set('Authorization', authHeader());

    expect(pending.status).toBe(202);
    expect(reconciled.status).toBe(200);
    expect(reconciled.body.status).toBe('SUCCESS');
    expect(
      await prisma.mockGatewayTransaction.count({
        where: { idempotencyKey: key },
      }),
    ).toBe(1);
    expect(
      (
        await prisma.order.findUniqueOrThrow({
          where: { id: created.body.id },
        })
      ).status,
    ).toBe(OrderStatus.PAID);
  });

  it('rolls back order and stock when inventory is insufficient and handles concurrent last stock', async () => {
    const overOrder = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', authHeader())
      .send(orderPayload(fixture.initialStock + 1));

    expect(overOrder.status).toBe(409);
    expect(overOrder.body.code).toBe('OUT_OF_STOCK');

    const createOrder = () =>
      request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', authHeader())
        .send(orderPayload(4));
    const responses = await Promise.all([createOrder(), createOrder()]);

    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(
      (
        await prisma.product.findUniqueOrThrow({
          where: { id: fixture.productId },
        })
      ).stockQuantity,
    ).toBe(1);
  });

  it('prevents different idempotency keys from charging the same order concurrently and rejects key reuse', async () => {
    const firstOrder = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', authHeader())
      .send(orderPayload(1));
    const keys = [randomUUID(), randomUUID()];
    usedKeys.push(...keys);

    const pay = (key: string) =>
      request(app.getHttpServer())
        .post('/payments')
        .set('Authorization', authHeader())
        .set('Idempotency-Key', key)
        .send({
          orderId: firstOrder.body.id,
          method: PaymentMethod.WALLET,
          scenario: 'SUCCESS',
        });
    const responses = await Promise.all(keys.map(pay));

    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(
      await prisma.payment.count({ where: { orderId: firstOrder.body.id } }),
    ).toBe(1);
    expect(
      await prisma.mockGatewayTransaction.count({
        where: { idempotencyKey: { in: keys } },
      }),
    ).toBe(1);

    const winnerKey =
      responses[0].status === 200 ? keys[0] : keys[1];
    const secondOrder = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', authHeader())
      .send(orderPayload(1));
    const reused = await request(app.getHttpServer())
      .post('/payments')
      .set('Authorization', authHeader())
      .set('Idempotency-Key', winnerKey)
      .send({
        orderId: secondOrder.body.id,
        method: PaymentMethod.CARD,
        scenario: 'SUCCESS',
      });
    expect(reused.status).toBe(422);
  });

  it('enforces staff role and valid fulfillment transitions via PATCH /orders/:id/status', async () => {
    const created = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', authHeader())
      .send(orderPayload(1));

    const forbiddenForCustomer = await request(app.getHttpServer())
      .patch(`/orders/${created.body.id}/status`)
      .set('Authorization', authHeader(fixture.token))
      .send({ status: OrderStatus.PREPARING });
    expect(forbiddenForCustomer.status).toBe(403);

    const unpaidTransition = await request(app.getHttpServer())
      .patch(`/orders/${created.body.id}/status`)
      .set('Authorization', authHeader(fixture.staffToken))
      .send({ status: OrderStatus.PREPARING });
    expect(unpaidTransition.status).toBe(400);

    const key = randomUUID();
    usedKeys.push(key);
    await request(app.getHttpServer())
      .post('/payments')
      .set('Authorization', authHeader())
      .set('Idempotency-Key', key)
      .send({
        orderId: created.body.id,
        method: PaymentMethod.WALLET,
        scenario: 'SUCCESS',
      });

    const invalidSkip = await request(app.getHttpServer())
      .patch(`/orders/${created.body.id}/status`)
      .set('Authorization', authHeader(fixture.staffToken))
      .send({ status: OrderStatus.COMPLETED });
    expect(invalidSkip.status).toBe(400);

    const staleExpected = await request(app.getHttpServer())
      .patch(`/orders/${created.body.id}/status`)
      .set('Authorization', authHeader(fixture.staffToken))
      .send({
        expectedStatus: OrderStatus.PREPARING,
        status: OrderStatus.READY,
      });
    expect(staleExpected.status).toBe(409);

    for (const nextStatus of [
      OrderStatus.PREPARING,
      OrderStatus.READY,
      OrderStatus.COMPLETED,
    ]) {
      const updated = await request(app.getHttpServer())
        .patch(`/orders/${created.body.id}/status`)
        .set('Authorization', authHeader(fixture.staffToken))
        .send({ status: nextStatus });
      expect(updated.status).toBe(200);
      expect(updated.body.status).toBe(nextStatus);
    }
  });

  it('validates promotions, earns and redeems loyalty points, and rolls back on declined payment', async () => {
    const promo = await prisma.promotion.create({
      data: {
        code: `TEST10-${randomUUID().slice(0, 6).toUpperCase()}`,
        discountType: DiscountType.PERCENT,
        discountValue: 10,
        minOrderAmount: 30000,
        startsAt: new Date(Date.now() - 60_000),
        endsAt: new Date(Date.now() + 600_000),
        usageLimit: 1,
        isActive: true,
      },
    });
    usedPromoIds.push(promo.id);

    const validated = await request(app.getHttpServer())
      .post('/promotions/validate')
      .send({ code: promo.code.toLowerCase(), subtotal: 82000 });
    expect(validated.status).toBe(200);
    expect(validated.body.discountAmount).toBe(8200);

    const firstOrder = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', authHeader())
      .send({ ...orderPayload(2), promoCode: promo.code });
    expect(firstOrder.status).toBe(201);
    expect(firstOrder.body.subtotal).toBe(82000);
    expect(firstOrder.body.discountAmount).toBe(8200);
    expect(firstOrder.body.totalAmount).toBe(73800);

    const payKey1 = randomUUID();
    usedKeys.push(payKey1);
    const paid = await request(app.getHttpServer())
      .post('/payments')
      .set('Authorization', authHeader())
      .set('Idempotency-Key', payKey1)
      .send({
        orderId: firstOrder.body.id,
        method: PaymentMethod.WALLET,
        scenario: 'SUCCESS',
      });
    expect(paid.status).toBe(200);

    const loyaltyAfterEarn = await request(app.getHttpServer())
      .get('/loyalty/me')
      .set('Authorization', authHeader());
    expect(loyaltyAfterEarn.status).toBe(200);
    expect(loyaltyAfterEarn.body.balance).toBe(7);

    const promo2 = await prisma.promotion.create({
      data: {
        code: `ROLLBACK-${randomUUID().slice(0, 6).toUpperCase()}`,
        discountType: DiscountType.FIXED_AMOUNT,
        discountValue: 5000,
        minOrderAmount: 30000,
        startsAt: new Date(Date.now() - 60_000),
        endsAt: new Date(Date.now() + 600_000),
        usageLimit: 1,
        isActive: true,
      },
    });
    usedPromoIds.push(promo2.id);

    const secondOrder = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', authHeader())
      .send({
        ...orderPayload(1),
        promoCode: promo2.code,
        redeemPoints: 4,
      });
    expect(secondOrder.status).toBe(201);
    expect(secondOrder.body.discountAmount).toBe(9000);
    expect(secondOrder.body.totalAmount).toBe(32000);

    const payKey2 = randomUUID();
    usedKeys.push(payKey2);
    const declined = await request(app.getHttpServer())
      .post('/payments')
      .set('Authorization', authHeader())
      .set('Idempotency-Key', payKey2)
      .send({
        orderId: secondOrder.body.id,
        method: PaymentMethod.CARD,
        scenario: 'DECLINED',
      });
    expect(declined.status).toBe(402);

    const loyaltyAfterRollback = await request(app.getHttpServer())
      .get('/loyalty/me')
      .set('Authorization', authHeader());
    expect(loyaltyAfterRollback.body.balance).toBe(7);

    const restoredPromo = await prisma.promotion.findUniqueOrThrow({
      where: { id: promo2.id },
    });
    expect(restoredPromo.usedCount).toBe(0);
  });

  it('TEST-01: rejects forged extra fields like unitPrice and userId with HTTP 400 while valid payload succeeds', async () => {
    const valid = orderPayload(2);

    await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', authHeader())
      .send({
        ...valid,
        items: [{ ...valid.items[0], unitPrice: 1 }],
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', authHeader())
      .send({
        ...valid,
        userId: fixture.otherUserId,
      })
      .expect(400);

    const created = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', authHeader())
      .send(valid)
      .expect(201);

    expect(created.body.userId).toBe(fixture.userId);
    expect(created.body.totalAmount).toBeGreaterThan(1000);
  });

  it('BE-04: rejects passwords exceeding 72 UTF-8 bytes on register/login and distinguishes 72-byte boundary secrets', async () => {
    const email = `utf8-${randomUUID()}@brewlite.local`;
    const seventyTwoBytes = `A1${'\u00e9'.repeat(35)}`; // 37 chars, 72 UTF-8 bytes
    const seventyThreeBytes = `${seventyTwoBytes}X`; // 38 chars, 73 UTF-8 bytes
    const differentTailSamePrefix = `A1${'\u00e9'.repeat(34)}\u00e8`;

    try {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email,
          fullName: 'Unicode Boundary User',
          password: seventyThreeBytes,
        })
        .expect(400);

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email,
          password: seventyThreeBytes,
        })
        .expect(400);

      const registered = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email,
          fullName: 'Unicode Boundary User',
          password: seventyTwoBytes,
        })
        .expect(201);
      expect(registered.body.email).toBe(email);

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email,
          password: seventyTwoBytes,
        })
        .expect(200);

      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email,
          password: differentTailSamePrefix,
        })
        .expect(401);
    } finally {
      await prisma.user.deleteMany({ where: { email } });
    }
  });

  it('BE-01: serializes POST /payments against expireStaleOrders() so cancelled order never charges gateway', async () => {
    const orderRes = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', authHeader())
      .send(orderPayload(2))
      .expect(201);
    const orderId = orderRes.body.id as string;

    await prisma.order.update({
      where: { id: orderId },
      data: { createdAt: new Date(Date.now() - 20 * 60 * 1000) },
    });

    const key = randomUUID();
    usedKeys.push(key);

    const [payRes, cancelledCount] = await Promise.all([
      request(app.getHttpServer())
        .post('/payments')
        .set('Authorization', authHeader())
        .set('Idempotency-Key', key)
        .send({ orderId, method: PaymentMethod.WALLET }),
      paymentJobs.expireStaleOrders(),
    ]);

    const finalOrder = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
    });
    const gwTx = await prisma.mockGatewayTransaction.findUnique({
      where: { idempotencyKey: key },
    });

    if (finalOrder.status === OrderStatus.CANCELLED) {
      expect(payRes.status).toBe(409);
      expect(gwTx).toBeNull();
      expect(cancelledCount).toBeGreaterThanOrEqual(1);
    } else {
      expect(payRes.status).toBe(200);
      expect(finalOrder.status).toBe(OrderStatus.PAID);
      expect(gwTx).not.toBeNull();
      expect(cancelledCount).toBe(0);
    }
  });

  it('BE-02: recovers interrupted DISPATCHING payment with expired lease and replays same key without duplicate charge', async () => {
    const orderRes = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', authHeader())
      .send(orderPayload(1))
      .expect(201);
    const orderId = orderRes.body.id as string;
    const key = randomUUID();
    usedKeys.push(key);

    const requestHash = createHash('sha256')
      .update(JSON.stringify({ orderId, method: PaymentMethod.WALLET }))
      .digest('hex');

    await prisma.idempotencyKey.create({
      data: {
        userId: fixture.userId,
        key,
        endpoint: 'POST /payments',
        requestHash,
        status: IdempotencyStatus.IN_PROGRESS,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const payment = await prisma.payment.create({
      data: {
        orderId,
        method: PaymentMethod.WALLET,
        status: PaymentStatus.PENDING,
        amount: orderRes.body.totalAmount as number,
        idempotencyKey: key,
        scenario: 'SUCCESS',
        dispatchStatus: PaymentDispatchStatus.DISPATCHING,
        attemptCount: 1,
        dispatchLeaseUntil: new Date(Date.now() - 1000),
      },
    });

    const recovered = await paymentJobs.recoverPendingPayments();
    expect(recovered).toBeGreaterThanOrEqual(1);

    const settledOrder = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
    });
    const settledPayment = await prisma.payment.findUniqueOrThrow({
      where: { id: payment.id },
    });
    expect(settledOrder.status).toBe(OrderStatus.PAID);
    expect(settledPayment.status).toBe(PaymentStatus.SUCCESS);
    expect(settledPayment.dispatchStatus).toBe(PaymentDispatchStatus.COMPLETED);

    const replay = await request(app.getHttpServer())
      .post('/payments')
      .set('Authorization', authHeader())
      .set('Idempotency-Key', key)
      .send({ orderId, method: PaymentMethod.WALLET })
      .expect(200);
    expect(replay.body.status).toBe('SUCCESS');

    const gwTxCount = await prisma.mockGatewayTransaction.count({
      where: { idempotencyKey: key },
    });
    expect(gwTxCount).toBe(1);
  });

  it('BE-03: concurrent GET /payments/:orderId/status returns [200, 200] with single loyalty earn and preserves PREPARING status', async () => {
    const orderRes = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', authHeader())
      .send(orderPayload(2))
      .expect(201);
    const orderId = orderRes.body.id as string;
    const key = randomUUID();
    usedKeys.push(key);

    await request(app.getHttpServer())
      .post('/payments')
      .set('Authorization', authHeader())
      .set('Idempotency-Key', key)
      .send({
        orderId,
        method: PaymentMethod.CARD,
        scenario: 'TIMEOUT_CHARGED',
      })
      .expect(202);

    const [r1, r2] = await Promise.all([
      request(app.getHttpServer())
        .get(`/payments/${orderId}/status`)
        .set('Authorization', authHeader()),
      request(app.getHttpServer())
        .get(`/payments/${orderId}/status`)
        .set('Authorization', authHeader()),
    ]);
    expect([r1.status, r2.status]).toEqual([200, 200]);

    const paidOrder = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
    });
    expect(paidOrder.status).toBe(OrderStatus.PAID);

    if (Math.floor((orderRes.body.totalAmount as number) / 10000) > 0) {
      const earnCount = await prisma.loyaltyTransaction.count({
        where: { orderId, type: LoyaltyType.EARN },
      });
      expect(earnCount).toBe(1);
    }

    await request(app.getHttpServer())
      .patch(`/orders/${orderId}/status`)
      .set('Authorization', authHeader(fixture.staffToken))
      .send({ status: OrderStatus.PREPARING })
      .expect(200);

    const afterPreparing = await request(app.getHttpServer())
      .get(`/payments/${orderId}/status`)
      .set('Authorization', authHeader())
      .expect(200);
    expect(afterPreparing.body.status).toBe('SUCCESS');

    const finalOrder = await prisma.order.findUniqueOrThrow({
      where: { id: orderId },
    });
    expect(finalOrder.status).toBe(OrderStatus.PREPARING);
  });
});
