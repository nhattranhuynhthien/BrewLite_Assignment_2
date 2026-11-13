import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { PaymentMethod } from '@prisma/client';
import request = require('supertest');
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Order and payment flow (PostgreSQL)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let fixture: {
    userId: string;
    token: string;
    categoryId: string;
    productId: string;
    sizeId: string;
    toppingId: string;
    initialStock: number;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);
  });

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: {
        email: `${randomUUID()}@integration.test`,
        fullName: 'Integration Customer',
        passwordHash: 'not-used-by-this-test',
      },
    });
    const category = await prisma.category.create({ data: { name: `Category ${randomUUID()}` } });
    const topping = await prisma.topping.create({
      data: { name: `Topping ${randomUUID()}`, extraPrice: 6000 },
    });
    const product = await prisma.product.create({
      data: {
        categoryId: category.id,
        name: `Product ${randomUUID()}`,
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
      token: jwtService.sign({ sub: user.id }),
      categoryId: category.id,
      productId: product.id,
      sizeId: size.id,
      toppingId: topping.id,
      initialStock: 5,
    };
  });

  afterEach(async () => {
    await prisma.payment.deleteMany({ where: { order: { userId: fixture.userId } } });
    await prisma.order.deleteMany({ where: { userId: fixture.userId } });
    await prisma.user.delete({ where: { id: fixture.userId } });
    await prisma.productTopping.deleteMany({ where: { productId: fixture.productId } });
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
          unitPrice: 1,
        },
      ],
    };
  }

  function authorization() {
    return `Bearer ${fixture.token}`;
  }

  it('creates an order, charges once, and replays the saved payment response', async () => {
    const created = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', authorization())
      .send(orderPayload());

    expect(created.status).toBe(201);
    expect(created.body.status).toBe('PENDING_PAYMENT');
    expect(created.body.totalAmount).toBe(82000);
    expect(created.body.items[0].unitPrice).toBe(41000);
    expect(
      (await prisma.product.findUniqueOrThrow({ where: { id: fixture.productId } }))
        .stockQuantity,
    ).toBe(3);

    const key = randomUUID();
    const paymentPayload = {
      orderId: created.body.id,
      method: PaymentMethod.WALLET,
      scenario: 'SUCCESS',
    };
    const first = await request(app.getHttpServer())
      .post('/payments')
      .set('Authorization', authorization())
      .set('Idempotency-Key', key)
      .send(paymentPayload);
    const replay = await request(app.getHttpServer())
      .post('/payments')
      .set('Authorization', authorization())
      .set('Idempotency-Key', key)
      .send(paymentPayload);

    expect(first.status).toBe(200);
    expect(replay.status).toBe(first.status);
    expect(replay.body).toEqual(first.body);
    expect(await prisma.payment.count({ where: { orderId: created.body.id } })).toBe(1);
    expect(
      (await prisma.order.findUniqueOrThrow({ where: { id: created.body.id } })).status,
    ).toBe('PAID');
    expect(
      (await prisma.product.findUniqueOrThrow({ where: { id: fixture.productId } }))
        .stockQuantity,
    ).toBe(3);
  });

  it('restores reserved stock when a wallet or card charge is declined', async () => {
    const created = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', authorization())
      .send(orderPayload(1));

    const payment = await request(app.getHttpServer())
      .post('/payments')
      .set('Authorization', authorization())
      .set('Idempotency-Key', randomUUID())
      .send({
        orderId: created.body.id,
        method: PaymentMethod.CARD,
        scenario: 'DECLINED',
      });

    expect(payment.status).toBe(402);
    expect(payment.body.status).toBe('FAILED');
    expect(
      (await prisma.order.findUniqueOrThrow({ where: { id: created.body.id } })).status,
    ).toBe('PAYMENT_FAILED');
    expect(
      (await prisma.product.findUniqueOrThrow({ where: { id: fixture.productId } }))
        .stockQuantity,
    ).toBe(fixture.initialStock);
  });

  it('reconciles a charged gateway timeout without charging a second time', async () => {
    const created = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', authorization())
      .send(orderPayload(1));
    const key = randomUUID();

    const pending = await request(app.getHttpServer())
      .post('/payments')
      .set('Authorization', authorization())
      .set('Idempotency-Key', key)
      .send({
        orderId: created.body.id,
        method: PaymentMethod.WALLET,
        scenario: 'TIMEOUT_CHARGED',
      });
    const reconciled = await request(app.getHttpServer())
      .get(`/payments/${created.body.id}/status`)
      .set('Authorization', authorization());

    expect(pending.status).toBe(202);
    expect(reconciled.status).toBe(200);
    expect(reconciled.body.status).toBe('SUCCESS');
    expect(await prisma.mockGatewayTransaction.count({ where: { idempotencyKey: key } })).toBe(1);
    expect(
      (await prisma.order.findUniqueOrThrow({ where: { id: created.body.id } })).status,
    ).toBe('PAID');
  });

  it('rolls back the order and stock reservation when inventory is insufficient', async () => {
    const response = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', authorization())
      .send(orderPayload(fixture.initialStock + 1));

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('OUT_OF_STOCK');
    expect(await prisma.order.count({ where: { userId: fixture.userId } })).toBe(0);
    expect(
      (await prisma.product.findUniqueOrThrow({ where: { id: fixture.productId } }))
        .stockQuantity,
    ).toBe(fixture.initialStock);
  });

  it('only lets one concurrent order reserve the final available stock', async () => {
    const createOrder = () =>
      request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', authorization())
        .send(orderPayload(4));
    const responses = await Promise.all([createOrder(), createOrder()]);

    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    expect(await prisma.order.count({ where: { userId: fixture.userId } })).toBe(1);
    expect(
      (await prisma.product.findUniqueOrThrow({ where: { id: fixture.productId } }))
        .stockQuantity,
    ).toBe(1);
  });

  it('prevents different idempotency keys from charging the same order concurrently', async () => {
    const created = await request(app.getHttpServer())
      .post('/orders')
      .set('Authorization', authorization())
      .send(orderPayload(1));
    const pay = (key: string) =>
      request(app.getHttpServer())
        .post('/payments')
        .set('Authorization', authorization())
        .set('Idempotency-Key', key)
        .send({
          orderId: created.body.id,
          method: PaymentMethod.WALLET,
          scenario: 'SUCCESS',
        });

    const keys = [randomUUID(), randomUUID()];
    const responses = await Promise.all(keys.map(pay));

    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(await prisma.payment.count({ where: { orderId: created.body.id } })).toBe(1);
    expect(
      await prisma.mockGatewayTransaction.count({ where: { idempotencyKey: { in: keys } } }),
    ).toBe(1);
  });

  it('rejects reusing a completed key for another order or payment method', async () => {
    const createOrder = () =>
      request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', authorization())
        .send(orderPayload(1));
    const firstOrder = await createOrder();
    const secondOrder = await createOrder();
    const key = randomUUID();

    await request(app.getHttpServer())
      .post('/payments')
      .set('Authorization', authorization())
      .set('Idempotency-Key', key)
      .send({
        orderId: firstOrder.body.id,
        method: PaymentMethod.WALLET,
        scenario: 'SUCCESS',
      });
    const reused = await request(app.getHttpServer())
      .post('/payments')
      .set('Authorization', authorization())
      .set('Idempotency-Key', key)
      .send({
        orderId: secondOrder.body.id,
        method: PaymentMethod.CARD,
        scenario: 'SUCCESS',
      });

    expect(reused.status).toBe(422);
  });
});
