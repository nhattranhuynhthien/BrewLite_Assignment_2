import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { PaymentMethod } from '@prisma/client';
import { MockPaymentScenario } from '../mock-payment-scenario';

export class CreatePaymentDto {
  @IsUUID()
  orderId!: string;

  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @IsOptional()
  @IsEnum(MockPaymentScenario)
  scenario?: MockPaymentScenario;
}
