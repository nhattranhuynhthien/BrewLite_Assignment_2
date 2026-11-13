import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ProductsModule } from '../products/products.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { PricingService } from './pricing.service';

@Module({
  imports: [AuthModule, ProductsModule],
  controllers: [OrdersController],
  providers: [OrdersService, PricingService],
  exports: [OrdersService],
})
export class OrdersModule {}
