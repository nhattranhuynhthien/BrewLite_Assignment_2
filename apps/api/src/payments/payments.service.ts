import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  Inject,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  IdempotencyStatus,
  OrderStatus,
  PaymentStatus,
  Prisma,
} from '@prisma/client';
import { createHash } from 'node:crypto';
import { OrdersService } from '../orders/orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import {
  GatewayTimeoutError,
  PAYMENT_GATEWAY,
  PaymentGateway,
} from './gateway/payment-gateway';
import { MockPaymentScenario } from './mock-payment-scenario';

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface ApiResult {
  statusCode?: number;
  body: Record<string, unknown>;
  headers?: Record<string, string>;
}

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ordersService: OrdersService,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
  ) {}

  async pay(
    userId: string,
    key: string | undefined,
    dto: CreatePaymentDto,
  ): Promise<ApiResult> {
    if (!key || !UUID_V4_REGEX.test(key)) {
      throw new BadRequestException('Idempotency-Key phải là UUID v4 hợp lệ');
    }

    const order = await this.ordersService.findOwnedOrder(userId, dto.orderId);
    const requestHash = createHash('sha256')
      .update(JSON.stringify({ orderId: dto.orderId, method: dto.method }))
      .digest('hex');

    const existing = await this.prisma.idempotencyKey.findUnique({
      where: { userId_key: { userId, key } },
    });
    if (existing) {
      return this.handleExistingKey(existing, requestHash);
    }

    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new ConflictException('Đơn hàng không ở trạng thái chờ thanh toán');
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.idempotencyKey.create({
          data: {
            userId,
            key,
            endpoint: 'POST /payments',
            requestHash,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });
        await tx.payment.create({
          data: {
            orderId: order.id,
            method: dto.method,
            amount: order.totalAmount,
            idempotencyKey: key,
          },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const duplicate = await this.prisma.idempotencyKey.findUnique({
          where: { userId_key: { userId, key } },
        });
        if (duplicate) {
          return this.handleExistingKey(duplicate, requestHash);
        }
        throw new ConflictException(
          'Đơn hàng đang có giao dịch thanh toán hoặc đã hoàn tất',
        );
      }
      throw error;
    }

    let charge: Awaited<ReturnType<PaymentGateway['charge']>>;
    try {
      charge = await this.chargeWithTimeout({
        amount: order.totalAmount,
        method: dto.method,
        idempotencyKey: key,
        scenario: dto.scenario ?? MockPaymentScenario.SUCCESS,
      });
    } catch (error) {
      if (error instanceof GatewayTimeoutError) {
        return {
          statusCode: HttpStatus.ACCEPTED,
          body: { orderId: order.id, status: 'PENDING' },
        };
      }
      throw error;
    }

    return this.completePayment(userId, order.id, key, charge);
  }

  async reconcile(userId: string, orderId: string): Promise<ApiResult> {
    await this.ordersService.findOwnedOrder(userId, orderId);
    const payment = await this.prisma.payment.findFirst({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });
    if (!payment) {
      return { body: { orderId, status: 'NOT_FOUND' } };
    }
    if (payment.status !== PaymentStatus.PENDING) {
      return {
        body: { orderId, paymentId: payment.id, status: payment.status },
      };
    }

    const status = await this.gateway.getStatus(payment.idempotencyKey);
    if (status === 'PENDING' || status === 'NOT_FOUND') {
      return {
        statusCode: HttpStatus.ACCEPTED,
        body: { orderId, paymentId: payment.id, status: 'PENDING' },
      };
    }
    return this.completePayment(userId, orderId, payment.idempotencyKey, {
      status,
    });
  }

  private async handleExistingKey(
    existing: {
      requestHash: string;
      status: IdempotencyStatus;
      responseStatus: number | null;
      responseBody: Prisma.JsonValue | null;
    },
    requestHash: string,
  ): Promise<ApiResult> {
    if (existing.requestHash !== requestHash) {
      throw new UnprocessableEntityException(
        'Idempotency-Key đã được dùng cho yêu cầu khác',
      );
    }

    if (existing.status === IdempotencyStatus.COMPLETED) {
      if (
        existing.responseStatus === null ||
        existing.responseBody === null ||
        Array.isArray(existing.responseBody) ||
        typeof existing.responseBody !== 'object'
      ) {
        throw new Error(
          'Completed idempotency record has no valid saved response',
        );
      }
      return {
        statusCode: existing.responseStatus,
        body: existing.responseBody as Prisma.JsonObject,
      };
    }

    return {
      statusCode: HttpStatus.CONFLICT,
      headers: { 'Retry-After': '2' },
      body: {
        code: 'IDEMPOTENCY_IN_PROGRESS',
        message: 'Giao dịch với Idempotency-Key này đang được xử lý',
      },
    };
  }

  private async chargeWithTimeout(
    request: Parameters<PaymentGateway['charge']>[0],
  ): Promise<Awaited<ReturnType<PaymentGateway['charge']>>> {
    const timeoutMs = Number(process.env.PAYMENT_TIMEOUT_MS ?? 5000);
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
      throw new Error('PAYMENT_TIMEOUT_MS must be a positive integer');
    }

    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        this.gateway.charge(request),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new GatewayTimeoutError()), timeoutMs);
        }),
      ]);
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
  }

  private async completePayment(
    userId: string,
    orderId: string,
    key: string,
    charge: {
      status: 'SUCCESS' | 'FAILED';
      gatewayTransactionId?: string;
      failureReason?: string;
    },
  ): Promise<ApiResult> {
    const isSuccess = charge.status === PaymentStatus.SUCCESS;
    const body: Prisma.InputJsonObject = isSuccess
      ? {
          orderId,
          status: 'SUCCESS',
          ...(charge.gatewayTransactionId
            ? { gatewayTransactionId: charge.gatewayTransactionId }
            : {}),
        }
      : {
          orderId,
          status: 'FAILED',
          reason: charge.failureReason ?? 'Thanh toán bị từ chối',
        };
    const statusCode = isSuccess ? HttpStatus.OK : HttpStatus.PAYMENT_REQUIRED;

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { idempotencyKey: key },
        data: {
          status: charge.status,
          gatewayTransactionId: charge.gatewayTransactionId,
          failureReason: charge.failureReason,
        },
      });

      const transitioned = isSuccess
        ? await this.ordersService.markPaid(orderId, tx)
        : await this.ordersService.markPaymentFailed(orderId, tx);
      if (!transitioned) {
        throw new ConflictException(
          'Đơn hàng đã rời khỏi trạng thái chờ thanh toán',
        );
      }

      await tx.idempotencyKey.update({
        where: { userId_key: { userId, key } },
        data: {
          status: IdempotencyStatus.COMPLETED,
          responseStatus: statusCode,
          responseBody: body,
        },
      });
    });

    return { statusCode, body };
  }
}
