import { Module } from '@nestjs/common';
import { ProductsModule } from '../products/products.module';
import { OrderStatusController } from './order-status.controller';
import { OrderStatusService } from './order-status.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';

@Module({
  imports: [ProductsModule],
  controllers: [OrdersController, OrderStatusController],
  providers: [OrdersService, OrderStatusService],
  exports: [OrdersService],
})
export class OrdersModule {}
