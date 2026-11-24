import { Module } from '@nestjs/common';
import { ConditionalModule, ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { LoyaltyModule } from './loyalty/loyalty.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { PostmanFixturesModule } from './orders/postman-fixtures.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';
import { PromotionsModule } from './promotions/promotions.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
      load: [configuration],
      validate: validateEnv,
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    ProductsModule,
    OrdersModule,
    ConditionalModule.registerWhen(
      PostmanFixturesModule,
      (env) =>
        (env.NODE_ENV === 'development' || env.NODE_ENV === 'test') &&
        env.POSTMAN_FIXTURES_ENABLED === 'true',
      { debug: false },
    ),
    PaymentsModule,
    PromotionsModule,
    LoyaltyModule,
  ],
})
export class AppModule {}
