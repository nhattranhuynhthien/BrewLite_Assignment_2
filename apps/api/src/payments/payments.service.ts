import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  IdempotencyStatus,
  OrderStatus,
  Payment,
  PaymentDispatchStatus,
  PaymentMethod,
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

const DEFAULT_PAYMENT_TIMEOUT_MS = 5000;
const DEFAULT_DISPATCH_LEASE_GRACE_MS = 5000;
const DEFAULT_MAX_DISPATCH_ATTEMPTS = 3;
const DEFAULT_RETRY_BASE_MS = 1000;
const DEFAULT_MAX_RETRY_BACKOFF_MS = 60_000;
const DEFAULT_MAX_RECONCILE_AGE_MS = 30 * 60 * 1000;

export interface ApiResult {
  statusCode?: number;
  body: Record<string, unknown>;
  headers?: Record<string, string>;
}

type ChargeSettlement = {
  status: 'SUCCESS' | 'FAILED';
  gatewayTransactionId?: string;
  failureReason?: string;
};

type ProbeOutcome =
  | ChargeSettlement
  | { status: 'PENDING' | 'NOT_FOUND' }
  | { status: 'ERROR'; error: unknown };

type ClaimLeaseResult =
  | { outcome: 'CLAIMED'; payment: Payment }
  | { outcome: 'BUSY' }
  | { outcome: 'ALREADY_FINAL'; payment: Payment }
  | { outcome: 'NEEDS_INTERVENTION'; payment: Payment };

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

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
      return this.resumeOrReplayExistingKey(userId, key, existing, requestHash);
    }

    const scenario = dto.scenario ?? MockPaymentScenario.SUCCESS;
    const attempt = await this.createPaymentAttempt(
      userId,
      order.id,
      key,
      dto.method,
      requestHash,
      scenario,
    );
    if (attempt.kind === 'existing') {
      return this.resumeOrReplayExistingKey(
        userId,
        key,
        attempt.existing,
        requestHash,
      );
    }

    return this.dispatchClaimedPayment(userId, attempt.payment, {
      throwOnTransientError: true,
    });
  }

  async reconcile(userId: string, orderId: string): Promise<ApiResult> {
    const order = await this.ordersService.findOwnedOrder(userId, orderId);
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

    const probe = await this.safeProbeGateway(payment.idempotencyKey);
    if (probe.status === 'SUCCESS' || probe.status === 'FAILED') {
      return this.completePayment(
        order.userId,
        orderId,
        payment.idempotencyKey,
        probe,
      );
    }

    if (probe.status === 'PENDING') {
      return this.handleGatewayStillPending(payment);
    }

    if (payment.dispatchStatus === PaymentDispatchStatus.NEEDS_INTERVENTION) {
      return this.needsInterventionResponse(payment);
    }

    if (probe.status === 'ERROR') {
      if (this.hasExceededReconcileAge(payment)) {
        const intervened = await this.markNeedsIntervention(
          payment,
          this.formatError(probe.error),
        );
        return this.needsInterventionResponse(intervened);
      }
      return this.pendingPaymentResponse(payment);
    }

    // Gateway returned NOT_FOUND.
    if (this.hasActiveLease(payment)) {
      return this.pendingPaymentResponse(payment);
    }

    if (
      payment.dispatchStatus === PaymentDispatchStatus.AWAITING_GATEWAY &&
      payment.nextRetryAt &&
      payment.nextRetryAt.getTime() > Date.now()
    ) {
      return this.pendingPaymentResponse(payment);
    }

    return this.recoverSinglePayment(order.userId, payment.id);
  }

  /** Recover pending payments that were interrupted before reaching or settling at the gateway. */
  async recoverPendingPayments(now = new Date()): Promise<number> {
    const candidates = await this.prisma.payment.findMany({
      where: {
        status: PaymentStatus.PENDING,
        dispatchStatus: {
          in: [
            PaymentDispatchStatus.PENDING_DISPATCH,
            PaymentDispatchStatus.DISPATCHING,
            PaymentDispatchStatus.AWAITING_GATEWAY,
          ],
        },
        AND: [
          {
            OR: [
              { dispatchLeaseUntil: null },
              { dispatchLeaseUntil: { lte: now } },
            ],
          },
          {
            OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
          },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
      include: { order: { select: { userId: true } } },
    });

    let recovered = 0;
    for (const candidate of candidates) {
      try {
        const result = await this.recoverSinglePayment(
          candidate.order.userId,
          candidate.id,
        );
        if (
          result.statusCode === HttpStatus.OK ||
          result.statusCode === HttpStatus.PAYMENT_REQUIRED
        ) {
          recovered += 1;
        }
      } catch (error) {
        this.logger.warn({
          event: 'payment_recovery_retry',
          paymentId: candidate.id,
          orderId: candidate.orderId,
          error: this.formatError(error),
        });
      }
    }
    return recovered;
  }

  private async recoverSinglePayment(
    userId: string,
    paymentId: string,
  ): Promise<ApiResult> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });
    if (!payment) {
      throw new NotFoundException('Không tìm thấy giao dịch thanh toán');
    }
    if (payment.status !== PaymentStatus.PENDING) {
      return this.syncAndBuildCompletedResult(userId, payment);
    }

    const initialProbe = await this.safeProbeGateway(payment.idempotencyKey);
    if (initialProbe.status === 'SUCCESS' || initialProbe.status === 'FAILED') {
      return this.completePayment(
        userId,
        payment.orderId,
        payment.idempotencyKey,
        initialProbe,
      );
    }
    if (initialProbe.status === 'PENDING') {
      return this.handleGatewayStillPending(payment);
    }
    if (payment.dispatchStatus === PaymentDispatchStatus.NEEDS_INTERVENTION) {
      return this.needsInterventionResponse(payment);
    }
    if (initialProbe.status === 'ERROR') {
      if (this.hasExceededReconcileAge(payment)) {
        const intervened = await this.markNeedsIntervention(
          payment,
          this.formatError(initialProbe.error),
        );
        return this.needsInterventionResponse(intervened);
      }
      return this.pendingPaymentResponse(payment);
    }

    if (
      payment.dispatchStatus === PaymentDispatchStatus.AWAITING_GATEWAY &&
      this.hasActiveLease(payment)
    ) {
      return this.pendingPaymentResponse(payment);
    }

    const claim = await this.claimDispatchLease(payment.id);
    if (claim.outcome === 'ALREADY_FINAL') {
      return this.syncAndBuildCompletedResult(userId, claim.payment);
    }
    if (claim.outcome === 'BUSY') {
      return this.pendingPaymentResponse(payment);
    }
    if (claim.outcome === 'NEEDS_INTERVENTION') {
      return this.needsInterventionResponse(claim.payment);
    }

    const postClaimProbe = await this.safeProbeGateway(
      claim.payment.idempotencyKey,
    );
    if (
      postClaimProbe.status === 'SUCCESS' ||
      postClaimProbe.status === 'FAILED'
    ) {
      return this.completePayment(
        userId,
        claim.payment.orderId,
        claim.payment.idempotencyKey,
        postClaimProbe,
      );
    }
    if (postClaimProbe.status === 'PENDING') {
      return this.markAwaitingGateway(claim.payment);
    }
    if (postClaimProbe.status === 'ERROR') {
      return this.handleDispatchFailure(
        userId,
        claim.payment,
        postClaimProbe.error,
        { throwOnTransientError: false },
      );
    }

    return this.dispatchClaimedPayment(userId, claim.payment, {
      throwOnTransientError: false,
    });
  }

  private async createPaymentAttempt(
    userId: string,
    orderId: string,
    key: string,
    method: PaymentMethod,
    requestHash: string,
    scenario: MockPaymentScenario,
  ): Promise<
    | { kind: 'created'; payment: Payment }
    | {
        kind: 'existing';
        existing: {
          requestHash: string;
          status: IdempotencyStatus;
          responseStatus: number | null;
          responseBody: Prisma.JsonValue | null;
        };
      }
  > {
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (typeof tx.$executeRaw === 'function') {
          await tx.$executeRaw`
            SELECT id FROM orders WHERE id = ${orderId}::uuid FOR UPDATE
          `;
        }

        const lockedOrder = await tx.order.findUnique({
          where: { id: orderId },
          select: { id: true, userId: true, status: true, totalAmount: true },
        });
        if (!lockedOrder) {
          throw new NotFoundException('Không tìm thấy đơn hàng');
        }
        if (lockedOrder.userId !== userId) {
          throw new ForbiddenException(
            'Bạn không có quyền truy cập đơn hàng này',
          );
        }

        if (tx.idempotencyKey?.findUnique) {
          const existingInTx = await tx.idempotencyKey.findUnique({
            where: { userId_key: { userId, key } },
          });
          if (existingInTx) {
            return { kind: 'existing', existing: existingInTx };
          }
        }

        if (lockedOrder.status !== OrderStatus.PENDING_PAYMENT) {
          throw new ConflictException(
            'Đơn hàng không ở trạng thái chờ thanh toán',
          );
        }

        if (tx.payment?.findFirst) {
          const activePayment = await tx.payment.findFirst({
            where: {
              orderId: lockedOrder.id,
              status: { in: [PaymentStatus.PENDING, PaymentStatus.SUCCESS] },
            },
            select: { id: true },
          });
          if (activePayment) {
            throw new ConflictException(
              'Đơn hàng đang có giao dịch thanh toán hoặc đã hoàn tất',
            );
          }
        }

        await tx.idempotencyKey.create({
          data: {
            userId,
            key,
            endpoint: 'POST /payments',
            requestHash,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });
        const payment = await tx.payment.create({
          data: {
            orderId: lockedOrder.id,
            method,
            amount: lockedOrder.totalAmount,
            idempotencyKey: key,
            scenario,
            dispatchStatus: PaymentDispatchStatus.DISPATCHING,
            attemptCount: 1,
            dispatchLeaseUntil: new Date(
              Date.now() + this.getDispatchLeaseMs(),
            ),
          },
        });
        return { kind: 'created', payment };
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
          return { kind: 'existing', existing: duplicate };
        }
        throw new ConflictException(
          'Đơn hàng đang có giao dịch thanh toán hoặc đã hoàn tất',
        );
      }
      throw error;
    }
  }

  private async resumeOrReplayExistingKey(
    userId: string,
    key: string,
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
      return this.handleExistingKey(existing, requestHash);
    }

    const payment = await this.prisma.payment.findUnique({
      where: { idempotencyKey: key },
    });
    if (!payment) {
      return this.handleExistingKey(existing, requestHash);
    }

    if (payment.status !== PaymentStatus.PENDING) {
      return this.syncAndBuildCompletedResult(userId, payment);
    }

    if (this.hasActiveLease(payment)) {
      return this.handleExistingKey(existing, requestHash);
    }

    const probe = await this.safeProbeGateway(key);
    if (probe.status === 'SUCCESS' || probe.status === 'FAILED') {
      return this.completePayment(userId, payment.orderId, key, probe);
    }
    if (probe.status === 'PENDING') {
      return this.markAwaitingGateway(payment);
    }
    if (payment.dispatchStatus === PaymentDispatchStatus.NEEDS_INTERVENTION) {
      throw new ServiceUnavailableException({
        code: 'PAYMENT_NEEDS_INTERVENTION',
        message: 'Giao dịch thanh toán đang chờ kiểm tra và đối soát thủ công',
      });
    }
    if (probe.status === 'ERROR') {
      throw new ServiceUnavailableException({
        code: 'PAYMENT_GATEWAY_UNAVAILABLE',
        message: 'Không thể xác minh trạng thái cổng thanh toán, vui lòng thử lại',
      });
    }
    if (
      payment.dispatchStatus === PaymentDispatchStatus.AWAITING_GATEWAY &&
      payment.nextRetryAt &&
      payment.nextRetryAt.getTime() > Date.now()
    ) {
      return {
        statusCode: HttpStatus.ACCEPTED,
        body: { orderId: payment.orderId, status: 'PENDING' },
      };
    }

    const claim = await this.claimDispatchLease(payment.id);
    if (claim.outcome === 'ALREADY_FINAL') {
      return this.syncAndBuildCompletedResult(userId, claim.payment);
    }
    if (claim.outcome === 'BUSY') {
      return this.handleExistingKey(existing, requestHash);
    }
    if (claim.outcome === 'NEEDS_INTERVENTION') {
      throw new ServiceUnavailableException({
        code: 'PAYMENT_NEEDS_INTERVENTION',
        message: 'Giao dịch thanh toán đang chờ kiểm tra và đối soát thủ công',
      });
    }

    const postClaimProbe = await this.safeProbeGateway(key);
    if (
      postClaimProbe.status === 'SUCCESS' ||
      postClaimProbe.status === 'FAILED'
    ) {
      return this.completePayment(
        userId,
        claim.payment.orderId,
        key,
        postClaimProbe,
      );
    }
    if (postClaimProbe.status === 'PENDING') {
      return this.markAwaitingGateway(claim.payment);
    }
    if (postClaimProbe.status === 'ERROR') {
      return this.handleDispatchFailure(
        userId,
        claim.payment,
        postClaimProbe.error,
        { throwOnTransientError: true },
      );
    }

    return this.dispatchClaimedPayment(userId, claim.payment, {
      throwOnTransientError: true,
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

  private async dispatchClaimedPayment(
    userId: string,
    payment: Payment,
    options: { throwOnTransientError: boolean },
  ): Promise<ApiResult> {
    try {
      const charge = await this.chargeWithTimeout({
        amount: payment.amount,
        method: payment.method,
        idempotencyKey: payment.idempotencyKey,
        scenario: this.parseScenario(payment.scenario),
      });
      return await this.completePayment(
        userId,
        payment.orderId,
        payment.idempotencyKey,
        charge,
      );
    } catch (error) {
      if (error instanceof GatewayTimeoutError) {
        return this.markAwaitingGateway(payment);
      }
      return this.handleDispatchFailure(userId, payment, error, options);
    }
  }

  private async handleDispatchFailure(
    userId: string,
    payment: Payment,
    error: unknown,
    options: { throwOnTransientError: boolean },
  ): Promise<ApiResult> {
    const probe = await this.safeProbeGateway(payment.idempotencyKey);
    if (probe.status === 'SUCCESS' || probe.status === 'FAILED') {
      return this.completePayment(
        userId,
        payment.orderId,
        payment.idempotencyKey,
        probe,
      );
    }
    if (probe.status === 'PENDING') {
      return this.markAwaitingGateway(payment);
    }

    const errorMessage = this.formatError(error);
    if (payment.attemptCount >= this.getMaxDispatchAttempts()) {
      const intervened = await this.markNeedsIntervention(payment, errorMessage);
      if (options.throwOnTransientError) {
        throw new ServiceUnavailableException({
          code: 'PAYMENT_NEEDS_INTERVENTION',
          message:
            'Giao dịch thanh toán gặp sự cố và cần kiểm tra đối soát thủ công',
        });
      }
      return this.needsInterventionResponse(intervened);
    }

    const delayMs = this.computeBackoffMs(payment.attemptCount);
    await this.prisma.payment.updateMany({
      where: { id: payment.id, status: PaymentStatus.PENDING },
      data: {
        dispatchStatus: PaymentDispatchStatus.PENDING_DISPATCH,
        dispatchLeaseUntil: null,
        nextRetryAt: new Date(Date.now() + delayMs),
        lastError: errorMessage,
      },
    });

    if (options.throwOnTransientError) {
      throw new ServiceUnavailableException({
        code: 'PAYMENT_GATEWAY_UNAVAILABLE',
        message: 'Cổng thanh toán tạm thời gián đoạn, vui lòng thử lại',
      });
    }
    return this.pendingPaymentResponse(payment);
  }

  private async claimDispatchLease(
    paymentId: string,
  ): Promise<ClaimLeaseResult> {
    const now = new Date();
    const leaseUntil = new Date(now.getTime() + this.getDispatchLeaseMs());
    const maxAttempts = this.getMaxDispatchAttempts();

    return this.prisma.$transaction(async (tx) => {
      if (typeof tx.$executeRaw === 'function') {
        await tx.$executeRaw`
          SELECT id FROM payments WHERE id = ${paymentId}::uuid FOR UPDATE
        `;
      }

      const current = await tx.payment.findUnique({
        where: { id: paymentId },
      });
      if (!current) {
        throw new NotFoundException('Không tìm thấy giao dịch thanh toán');
      }
      if (current.status !== PaymentStatus.PENDING) {
        return { outcome: 'ALREADY_FINAL', payment: current };
      }
      if (current.dispatchStatus === PaymentDispatchStatus.NEEDS_INTERVENTION) {
        return { outcome: 'NEEDS_INTERVENTION', payment: current };
      }
      if (
        current.dispatchStatus === PaymentDispatchStatus.DISPATCHING &&
        current.dispatchLeaseUntil &&
        current.dispatchLeaseUntil.getTime() > now.getTime()
      ) {
        return { outcome: 'BUSY' };
      }
      if (current.attemptCount >= maxAttempts) {
        const intervened = await tx.payment.update({
          where: { id: current.id },
          data: {
            dispatchStatus: PaymentDispatchStatus.NEEDS_INTERVENTION,
            dispatchLeaseUntil: null,
            nextRetryAt: null,
          },
        });
        this.logInterventionAlert(intervened);
        return { outcome: 'NEEDS_INTERVENTION', payment: intervened };
      }

      const claimed = await tx.payment.update({
        where: { id: current.id },
        data: {
          dispatchStatus: PaymentDispatchStatus.DISPATCHING,
          attemptCount: { increment: 1 },
          dispatchLeaseUntil: leaseUntil,
          nextRetryAt: null,
        },
      });
      return { outcome: 'CLAIMED', payment: claimed };
    });
  }

  private async markAwaitingGateway(payment: Payment): Promise<ApiResult> {
    const retryAt = new Date(Date.now() + this.getRetryBaseMs());
    await this.prisma.payment.updateMany({
      where: { id: payment.id, status: PaymentStatus.PENDING },
      data: {
        dispatchStatus: PaymentDispatchStatus.AWAITING_GATEWAY,
        dispatchLeaseUntil: null,
        nextRetryAt: retryAt,
      },
    });
    return {
      statusCode: HttpStatus.ACCEPTED,
      body: { orderId: payment.orderId, status: 'PENDING' },
    };
  }

  private async handleGatewayStillPending(
    payment: Payment,
  ): Promise<ApiResult> {
    if (this.hasExceededReconcileAge(payment)) {
      const intervened = await this.markNeedsIntervention(
        payment,
        'Gateway confirmation exceeded maximum wait window',
      );
      return this.needsInterventionResponse(intervened);
    }

    if (payment.dispatchStatus !== PaymentDispatchStatus.AWAITING_GATEWAY) {
      await this.prisma.payment.updateMany({
        where: { id: payment.id, status: PaymentStatus.PENDING },
        data: {
          dispatchStatus: PaymentDispatchStatus.AWAITING_GATEWAY,
          dispatchLeaseUntil: null,
          nextRetryAt: new Date(Date.now() + this.getRetryBaseMs()),
        },
      });
    }
    return this.pendingPaymentResponse(payment);
  }

  private async markNeedsIntervention(
    payment: Payment,
    reason: string,
  ): Promise<Payment> {
    await this.prisma.payment.updateMany({
      where: { id: payment.id, status: PaymentStatus.PENDING },
      data: {
        dispatchStatus: PaymentDispatchStatus.NEEDS_INTERVENTION,
        dispatchLeaseUntil: null,
        nextRetryAt: null,
        lastError: reason,
      },
    });
    const refreshed =
      (await this.prisma.payment.findUnique({ where: { id: payment.id } })) ??
      payment;
    if (
      refreshed.status === PaymentStatus.PENDING &&
      refreshed.dispatchStatus === PaymentDispatchStatus.NEEDS_INTERVENTION
    ) {
      this.logInterventionAlert(refreshed);
    }
    return refreshed;
  }

  private logInterventionAlert(payment: Payment): void {
    this.logger.error({
      event: 'payment_needs_intervention',
      paymentId: payment.id,
      orderId: payment.orderId,
      idempotencyKey: payment.idempotencyKey,
      attemptCount: payment.attemptCount,
      lastError: payment.lastError,
    });
  }

  private pendingPaymentResponse(payment: Payment): ApiResult {
    return {
      statusCode: HttpStatus.ACCEPTED,
      body: { orderId: payment.orderId, paymentId: payment.id, status: 'PENDING' },
    };
  }

  private needsInterventionResponse(payment: Payment): ApiResult {
    return {
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      body: {
        orderId: payment.orderId,
        paymentId: payment.id,
        status: 'NEEDS_INTERVENTION',
        code: 'PAYMENT_NEEDS_INTERVENTION',
        message:
          'Giao dịch thanh toán chưa thể tự xác nhận và đang chờ đối soát thủ công',
      },
    };
  }

  private async syncAndBuildCompletedResult(
    userId: string,
    payment: Payment,
  ): Promise<ApiResult> {
    if (payment.status === PaymentStatus.PENDING) {
      return this.pendingPaymentResponse(payment);
    }
    return this.completePayment(userId, payment.orderId, payment.idempotencyKey, {
      status: payment.status,
      gatewayTransactionId: payment.gatewayTransactionId ?? undefined,
      failureReason: payment.failureReason ?? undefined,
    });
  }

  private async safeProbeGateway(idempotencyKey: string): Promise<ProbeOutcome> {
    try {
      if (typeof this.gateway.getTransaction === 'function') {
        return await this.gateway.getTransaction(idempotencyKey);
      }
      const status = await this.gateway.getStatus(idempotencyKey);
      return { status };
    } catch (error) {
      return { status: 'ERROR', error };
    }
  }

  private async chargeWithTimeout(
    request: Parameters<PaymentGateway['charge']>[0],
  ): Promise<Awaited<ReturnType<PaymentGateway['charge']>>> {
    const timeoutMs = this.getTimeoutMs();
    const chargePromise = this.gateway.charge(request);
    // Prevent unhandled rejection if timeout settles Promise.race first.
    chargePromise.catch(() => undefined);

    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        chargePromise,
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
    charge: ChargeSettlement,
  ): Promise<ApiResult> {
    return this.prisma.$transaction(async (tx) => {
      if (typeof tx.$executeRaw === 'function') {
        // Canonical lock order across payment/order flows: orders -> payments.
        await tx.$executeRaw`
          SELECT id FROM orders WHERE id = ${orderId}::uuid FOR UPDATE
        `;
        await tx.$executeRaw`
          SELECT id FROM payments WHERE idempotency_key = ${key} FOR UPDATE
        `;
      }

      const lockedPayment = await tx.payment.findUnique({
        where: { idempotencyKey: key },
      });
      if (!lockedPayment) {
        throw new ConflictException('Không tìm thấy giao dịch thanh toán');
      }

      if (lockedPayment.status !== PaymentStatus.PENDING) {
        if (lockedPayment.status !== charge.status) {
          throw new ConflictException(
            'Giao dịch thanh toán đã được chốt với trạng thái khác',
          );
        }

        const existingKey = tx.idempotencyKey?.findUnique
          ? await tx.idempotencyKey.findUnique({
              where: { userId_key: { userId, key } },
            })
          : null;

        if (
          existingKey?.status === IdempotencyStatus.COMPLETED &&
          existingKey.responseStatus !== null &&
          existingKey.responseBody !== null &&
          !Array.isArray(existingKey.responseBody) &&
          typeof existingKey.responseBody === 'object'
        ) {
          return {
            statusCode: existingKey.responseStatus,
            body: existingKey.responseBody as Prisma.JsonObject,
          };
        }

        const settledResult = this.buildFinalPaymentResult(orderId, {
          status: lockedPayment.status,
          gatewayTransactionId:
            lockedPayment.gatewayTransactionId ?? charge.gatewayTransactionId,
          failureReason: lockedPayment.failureReason ?? charge.failureReason,
        });

        if (existingKey && existingKey.status !== IdempotencyStatus.COMPLETED) {
          await tx.idempotencyKey.updateMany({
            where: { userId, key },
            data: {
              status: IdempotencyStatus.COMPLETED,
              responseStatus: settledResult.statusCode,
              responseBody: settledResult.body,
            },
          });
        }

        return settledResult;
      }

      const finalResult = this.buildFinalPaymentResult(orderId, charge);

      await tx.payment.update({
        where: { idempotencyKey: key },
        data: {
          status: charge.status,
          dispatchStatus: PaymentDispatchStatus.COMPLETED,
          dispatchLeaseUntil: null,
          nextRetryAt: null,
          lastError: null,
          gatewayTransactionId:
            charge.gatewayTransactionId ?? lockedPayment.gatewayTransactionId,
          failureReason: charge.failureReason ?? lockedPayment.failureReason,
        },
      });

      const transitioned =
        charge.status === PaymentStatus.SUCCESS
          ? await this.ordersService.markPaid(orderId, tx)
          : await this.ordersService.markPaymentFailed(orderId, tx);
      if (!transitioned) {
        throw new ConflictException(
          'Đơn hàng đã rời khỏi trạng thái chờ thanh toán',
        );
      }

      await tx.idempotencyKey.updateMany({
        where: { userId, key },
        data: {
          status: IdempotencyStatus.COMPLETED,
          responseStatus: finalResult.statusCode,
          responseBody: finalResult.body,
        },
      });

      return finalResult;
    });
  }

  private buildFinalPaymentResult(
    orderId: string,
    charge: ChargeSettlement,
  ): { statusCode: number; body: Prisma.InputJsonObject } {
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
    return {
      statusCode: isSuccess ? HttpStatus.OK : HttpStatus.PAYMENT_REQUIRED,
      body,
    };
  }

  private hasActiveLease(payment: Payment): boolean {
    return (
      payment.dispatchStatus === PaymentDispatchStatus.DISPATCHING &&
      payment.dispatchLeaseUntil !== null &&
      payment.dispatchLeaseUntil.getTime() > Date.now()
    );
  }

  private hasExceededReconcileAge(payment: Payment): boolean {
    return (
      Date.now() - payment.createdAt.getTime() >= this.getMaxReconcileAgeMs()
    );
  }

  private computeBackoffMs(attemptCount: number): number {
    const base = this.getRetryBaseMs();
    return Math.min(
      DEFAULT_MAX_RETRY_BACKOFF_MS,
      base * 2 ** Math.max(0, attemptCount - 1),
    );
  }

  private parseScenario(raw: string): MockPaymentScenario {
    if (
      Object.values(MockPaymentScenario).includes(raw as MockPaymentScenario)
    ) {
      return raw as MockPaymentScenario;
    }
    return MockPaymentScenario.SUCCESS;
  }

  private formatError(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  private getTimeoutMs(): number {
    const timeoutMs = Number(
      process.env.PAYMENT_TIMEOUT_MS ?? DEFAULT_PAYMENT_TIMEOUT_MS,
    );
    if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
      throw new Error('PAYMENT_TIMEOUT_MS must be a positive integer');
    }
    return timeoutMs;
  }

  private getDispatchLeaseMs(): number {
    const leaseMs = Number(
      process.env.PAYMENT_DISPATCH_LEASE_MS ??
        this.getTimeoutMs() + DEFAULT_DISPATCH_LEASE_GRACE_MS,
    );
    if (!Number.isInteger(leaseMs) || leaseMs <= 0) {
      throw new Error('PAYMENT_DISPATCH_LEASE_MS must be a positive integer');
    }
    return leaseMs;
  }

  private getMaxDispatchAttempts(): number {
    const maxAttempts = Number(
      process.env.PAYMENT_MAX_DISPATCH_ATTEMPTS ?? DEFAULT_MAX_DISPATCH_ATTEMPTS,
    );
    if (!Number.isInteger(maxAttempts) || maxAttempts <= 0) {
      throw new Error(
        'PAYMENT_MAX_DISPATCH_ATTEMPTS must be a positive integer',
      );
    }
    return maxAttempts;
  }

  private getRetryBaseMs(): number {
    const baseMs = Number(
      process.env.PAYMENT_RETRY_BASE_MS ?? DEFAULT_RETRY_BASE_MS,
    );
    if (!Number.isInteger(baseMs) || baseMs < 0) {
      throw new Error('PAYMENT_RETRY_BASE_MS must be a non-negative integer');
    }
    return baseMs;
  }

  private getMaxReconcileAgeMs(): number {
    const maxAgeMs = Number(
      process.env.PAYMENT_MAX_RECONCILE_AGE_MS ?? DEFAULT_MAX_RECONCILE_AGE_MS,
    );
    if (!Number.isInteger(maxAgeMs) || maxAgeMs <= 0) {
      throw new Error(
        'PAYMENT_MAX_RECONCILE_AGE_MS must be a positive integer',
      );
    }
    return maxAgeMs;
  }
}
