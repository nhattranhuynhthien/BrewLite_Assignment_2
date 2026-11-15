import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { OrdersModule } from '../orders/orders.module';
import { MockPaymentGateway } from './gateway/mock-payment.gateway';
import { PAYMENT_GATEWAY } from './gateway/payment-gateway';
import { PaymentJobs } from './payment.jobs';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [OrdersModule, ScheduleModule.forRoot()],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    PaymentJobs,
    { provide: PAYMENT_GATEWAY, useClass: MockPaymentGateway },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
