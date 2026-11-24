import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  Controller,
  Module,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { OrderStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
import { JwtAuthGuard, StaffOnly } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

const SAMPLE_PRODUCT_ID = '10000000-0000-4000-8000-000000000001';

@ApiExcludeController()
@Controller('_test/postman/orders')
@UseGuards(JwtAuthGuard)
@StaffOnly()
class PostmanFixturesController {
  constructor(private readonly db: PrismaService) {}

  @Post()
  createOrders() {
    return this.db.$transaction(async (tx) => {
      const [customer, product] = await Promise.all([
        tx.user.findUnique({
          where: { email: 'customer@brewlite.local' },
          select: { id: true },
        }),
        tx.product.findUnique({
          where: { id: SAMPLE_PRODUCT_ID },
          include: {
            sizes: { where: { name: 'S', isAvailable: true } },
            toppings: {
              where: { topping: { isAvailable: true } },
              include: { topping: true },
            },
          },
        }),
      ]);
      const size = product?.sizes[0];
      const topping = product?.toppings[0]?.topping;
      if (!customer || !product?.isAvailable || !size || !topping) {
        throw new ConflictException('Chạy seed danh mục và tài khoản mẫu trước khi chạy Postman.');
      }

      const amount = product.basePrice + size.extraPrice + topping.extraPrice;
      const createOrder = (status: OrderStatus, paymentStatus: PaymentStatus) =>
        tx.order.create({
          data: {
            userId: customer.id,
            status,
            subtotal: amount,
            totalAmount: amount,
            note: 'BrewLite Postman fixture',
            items: {
              create: {
                productId: product.id,
                sizeId: size.id,
                productName: product.name,
                sizeName: size.name,
                unitPrice: amount,
                quantity: 1,
                lineTotal: amount,
                toppings: {
                  create: {
                    toppingId: topping.id,
                    toppingName: topping.name,
                    extraPrice: topping.extraPrice,
                  },
                },
              },
            },
            payments: {
              create: {
                method: PaymentMethod.WALLET,
                status: paymentStatus,
                amount,
                idempotencyKey: `postman-fixture-${randomUUID()}`,
              },
            },
          },
          select: { id: true, status: true },
        });

      const paidOrder = await createOrder(OrderStatus.PAID, PaymentStatus.SUCCESS);
      const pendingOrder = await createOrder(
        OrderStatus.PENDING_PAYMENT,
        PaymentStatus.PENDING,
      );
      return { paidOrder, pendingOrder };
    });
  }
}

@Module({ controllers: [PostmanFixturesController] })
export class PostmanFixturesModule {}
