import { PaymentMethod } from '@prisma/client';
import { MockPaymentScenario } from '../mock-payment-scenario';

export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');

export type GatewayStatus = 'SUCCESS' | 'FAILED' | 'PENDING' | 'NOT_FOUND';

export interface ChargeRequest {
  amount: number;
  method: PaymentMethod;
  idempotencyKey: string;
  scenario: MockPaymentScenario;
}

export interface ChargeResult {
  status: 'SUCCESS' | 'FAILED';
  gatewayTransactionId: string;
  failureReason?: string;
}

export interface PaymentGateway {
  charge(request: ChargeRequest): Promise<ChargeResult>;
  getStatus(idempotencyKey: string): Promise<GatewayStatus>;
}

export class GatewayTimeoutError extends Error {
  constructor() {
    super('Mock payment gateway timed out');
    this.name = 'GatewayTimeoutError';
  }
}
