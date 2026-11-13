import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrdersModule } from '../orders/orders.module';
import { MockPaymentGateway } from './gateway/mock-payment.gateway';
import { PAYMENT_GATEWAY } from './gateway/payment-gateway';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [AuthModule, OrdersModule],
  controllers: [PaymentsController],
  providers: [
    {
      provide: 'PAYMENT_PROVIDER_CONFIGURATION',
      useFactory: () => {
        const provider = process.env.PAYMENT_PROVIDER ?? 'mock';
        if (provider !== 'mock') {
          throw new Error(`Unsupported PAYMENT_PROVIDER: ${provider}`);
        }
        return provider;
      },
    },
    PaymentsService,
    MockPaymentGateway,
    { provide: PAYMENT_GATEWAY, useExisting: MockPaymentGateway },
  ],
})
export class PaymentsModule {}
