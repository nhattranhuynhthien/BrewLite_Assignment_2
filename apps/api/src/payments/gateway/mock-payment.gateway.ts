import { Injectable } from '@nestjs/common';
import { PaymentStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { MockPaymentScenario } from '../mock-payment-scenario';
import {
  ChargeRequest,
  ChargeResult,
  GatewayTimeoutError,
  GatewayStatus,
  PaymentGateway,
} from './payment-gateway';

@Injectable()
export class MockPaymentGateway implements PaymentGateway {
  constructor(private readonly prisma: PrismaService) {}

  async charge(request: ChargeRequest): Promise<ChargeResult> {
    const existing = await this.prisma.mockGatewayTransaction.findUnique({
      where: { idempotencyKey: request.idempotencyKey },
    });
    if (existing) {
      return this.toChargeResult(existing);
    }

    const delay = Number(process.env.MOCK_PAYMENT_DELAY_MS ?? 0);
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    const timedOut =
      request.scenario === MockPaymentScenario.TIMEOUT_CHARGED ||
      request.scenario === MockPaymentScenario.TIMEOUT_NOT_CHARGED;
    const status =
      request.scenario === MockPaymentScenario.DECLINED ||
      request.scenario === MockPaymentScenario.TIMEOUT_NOT_CHARGED
        ? PaymentStatus.FAILED
        : PaymentStatus.SUCCESS;
    const result = {
      idempotencyKey: request.idempotencyKey,
      status,
      scenario: request.scenario,
      gatewayTransactionId: randomUUID(),
      failureReason: status === PaymentStatus.FAILED ? 'Mock payment declined' : null,
    };

    let transaction: Awaited<
      ReturnType<typeof this.prisma.mockGatewayTransaction.create>
    >;
    try {
      transaction = await this.prisma.mockGatewayTransaction.create({ data: result });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        transaction = await this.prisma.mockGatewayTransaction.findUniqueOrThrow({
          where: { idempotencyKey: request.idempotencyKey },
        });
      } else {
        throw error;
      }
    }

    if (timedOut) {
      throw new GatewayTimeoutError();
    }
    return this.toChargeResult(transaction);
  }

  async getStatus(idempotencyKey: string): Promise<GatewayStatus> {
    const transaction = await this.prisma.mockGatewayTransaction.findUnique({
      where: { idempotencyKey },
    });
    return transaction?.status ?? 'NOT_FOUND';
  }

  private toChargeResult(transaction: {
    status: PaymentStatus;
    gatewayTransactionId: string;
    failureReason: string | null;
  }): ChargeResult {
    if (transaction.status === PaymentStatus.PENDING) {
      throw new Error('Mock gateway transaction has not reached a final status');
    }
    return {
      status: transaction.status,
      gatewayTransactionId: transaction.gatewayTransactionId,
      ...(transaction.failureReason ? { failureReason: transaction.failureReason } : {}),
    };
  }
}
