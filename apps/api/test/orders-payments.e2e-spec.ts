import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { OrderStatus, PaymentMethod, UserRole } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('BrewLite Order, Payment & Fulfillment Flow (PostgreSQL)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let usedKeys: string[] = [];
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
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);
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
    await prisma.payment.deleteMany({
      where: { order: { userId: { in: userIds } } },
    });
    await prisma.order.deleteMany({ where: { userId: { in: userIds } } });
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
          unitPrice: 1, // forged client price must be stripped/ignored
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
});
