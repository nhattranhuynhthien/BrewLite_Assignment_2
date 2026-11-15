import { Module } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService, PricingService],
  exports: [ProductsService, PricingService],
})
export class ProductsModule {}
