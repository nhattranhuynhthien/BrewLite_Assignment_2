import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '@prisma/client';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { MockPaymentScenario } from '../mock-payment-scenario';

export class CreatePaymentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  orderId!: string;

  @ApiProperty({ enum: PaymentMethod, example: PaymentMethod.WALLET })
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @ApiPropertyOptional({
    enum: MockPaymentScenario,
    default: MockPaymentScenario.SUCCESS,
  })
  @IsOptional()
  @IsEnum(MockPaymentScenario)
  scenario?: MockPaymentScenario;
}
