import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from '../products/pricing.service';
import { ProductsService } from '../products/products.service';
import { PromotionsService } from '../promotions/promotions.service';
import { CreateOrderDto } from './dto/create-order.dto';

const PAGE_SIZE = 20;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productsService: ProductsService,
    private readonly pricingService: PricingService,
    @Optional() private readonly promotionsService?: PromotionsService,
    @Optional() private readonly loyaltyService?: LoyaltyService,
  ) {}

  async createOrder(userId: string, dto: CreateOrderDto) {
    return this.prisma.$transaction(
      async (tx) => {
        const preparedItems: {
          productId: string;
          sizeId: string;
          productName: string;
          sizeName: string;
          unitPrice: number;
          quantity: number;
          lineTotal: number;
          toppings: {
            toppingId: string;
            toppingName: string;
            extraPrice: number;
          }[];
        }[] = [];

        for (const item of dto.items) {
          const uniqueToppingIds = [...new Set(item.toppingIds)];
          if (uniqueToppingIds.length !== item.toppingIds.length) {
            throw new BadRequestException(
              'Mỗi topping chỉ được chọn một lần trên cùng một món',
            );
          }

          const product = await this.productsService.getProductForOrder(
            item.productId,
            tx,
          );
          if (!product || !product.isAvailable) {
            throw new NotFoundException(
              `Sản phẩm ${item.productId} hiện không khả dụng`,
            );
          }

          const size = product.sizes.find(
            (candidate) => candidate.id === item.sizeId,
          );
          if (!size) {
            throw new BadRequestException(
              'Size được chọn không hợp lệ cho sản phẩm này',
            );
          }

          const toppings = uniqueToppingIds.map((toppingId) => {
            const allowed = product.toppings.find(
              (candidate) =>
                candidate.topping.id === toppingId &&
                candidate.topping.isAvailable,
            );
            if (!allowed) {
              throw new BadRequestException(
                'Topping được chọn không hợp lệ cho sản phẩm này',
              );
            }
            return {
              toppingId,
              toppingName: allowed.topping.name,
              extraPrice: allowed.topping.extraPrice,
            };
          });

          const price = this.pricingService.calculateLine(
            product.basePrice,
            size.extraPrice,
            toppings.map((topping) => topping.extraPrice),
            item.quantity,
          );

          preparedItems.push({
            productId: product.id,
            sizeId: size.id,
            productName: product.name,
            sizeName: size.name,
            unitPrice: price.unitPrice,
            quantity: item.quantity,
            lineTotal: price.lineTotal,
            toppings,
          });
        }

        const stockByProduct = new Map<string, number>();
        for (const item of preparedItems) {
          stockByProduct.set(
            item.productId,
            (stockByProduct.get(item.productId) ?? 0) + item.quantity,
          );
        }

        // Decrement in sorted ascending productId order to eliminate cross-transaction deadlocks.
        for (const [productId, quantity] of [...stockByProduct.entries()].sort(
          ([a], [b]) => a.localeCompare(b),
        )) {
          const reserved = await this.productsService.decreaseStock(
            productId,
            quantity,
            tx,
          );
          if (!reserved) {
            throw new ConflictException({
              code: 'OUT_OF_STOCK',
              message: `Sản phẩm ${productId} không đủ tồn kho`,
            });
          }
        }

        const subtotal = preparedItems.reduce(
          (total, item) => total + item.lineTotal,
          0,
        );

        let promotionId: string | undefined;
        let promoDiscount = 0;
        const promoCode = dto.promoCode?.trim();
        if (promoCode) {
          if (!this.promotionsService) {
            throw new BadRequestException('Dịch vụ khuyến mãi chưa sẵn sàng');
          }
          const reservedPromo = await this.promotionsService.reserveInTransaction(
            tx,
            promoCode,
            subtotal,
          );
          promotionId = reservedPromo.promotion.id;
          promoDiscount = reservedPromo.discountAmount;
        }

        const remainingAfterPromo = Math.max(0, subtotal - promoDiscount);
        const requestedPoints = dto.redeemPoints ?? 0;
        let pointsUsed = 0;
        let loyaltyDiscount = 0;
        if (requestedPoints > 0) {
          if (!this.loyaltyService) {
            throw new BadRequestException('Dịch vụ tích điểm chưa sẵn sàng');
          }
          const redeemed =
            await this.loyaltyService.calculateRedemptionInTransaction(
              tx,
              userId,
              requestedPoints,
              remainingAfterPromo,
            );
          pointsUsed = redeemed.pointsUsed;
          loyaltyDiscount = redeemed.discountAmount;
        }

        const discountAmount = promoDiscount + loyaltyDiscount;
        const totalAmount = Math.max(0, subtotal - discountAmount);

        const order = await tx.order.create({
          data: {
            userId,
            subtotal,
            discountAmount,
            totalAmount,
            promotionId,
            note: dto.note?.trim() || undefined,
            items: {
              create: preparedItems.map((item) => ({
                productId: item.productId,
                sizeId: item.sizeId,
                productName: item.productName,
                sizeName: item.sizeName,
                unitPrice: item.unitPrice,
                quantity: item.quantity,
                lineTotal: item.lineTotal,
                toppings: { create: item.toppings },
              })),
            },
          },
          include: { items: { include: { toppings: true } } },
        });

        if (pointsUsed > 0 && this.loyaltyService) {
          await this.loyaltyService.recordRedemptionInTransaction(
            tx,
            userId,
            order.id,
            pointsUsed,
          );
        }

        return order;
      },
      { maxWait: 5000, timeout: 10000 },
    );
  }

  async history(userId: string, page = 1) {
    const where = { userId };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        include: { items: { include: { toppings: true } }, payments: true },
      }),
      this.prisma.order.count({ where }),
    ]);

    return { items, total, page, pageSize: PAGE_SIZE };
  }

  async findOwnedOrder(userId: string, orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { toppings: true } }, payments: true },
    });
    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng');
    }
    if (order.userId !== userId) {
      throw new ForbiddenException('Bạn không có quyền truy cập đơn hàng này');
    }
    return order;
  }

  async markPaid(
    orderId: string,
    tx: Prisma.TransactionClient,
  ): Promise<boolean> {
    const result = await tx.order.updateMany({
      where: { id: orderId, status: OrderStatus.PENDING_PAYMENT },
      data: { status: OrderStatus.PAID },
    });
    if (result.count !== 1) {
      return false;
    }
    if (this.loyaltyService) {
      await this.loyaltyService.earnForPaidOrder(tx, orderId);
    }
    return true;
  }

  /**
   * Release reserved inventory, promo slots, and redeemed loyalty points
   * when an unpaid order fails or expires.
   */
  async releaseOrderAdjustments(
    orderId: string,
    promotionId: string | null,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const items = await tx.orderItem.findMany({
      where: { orderId },
      select: { productId: true, quantity: true },
    });
    await this.productsService.restoreStock(items, tx);
    if (promotionId && this.promotionsService) {
      await this.promotionsService.releaseInTransaction(tx, promotionId);
    }
    if (this.loyaltyService) {
      await this.loyaltyService.refundOrderRedemption(tx, orderId);
    }
  }

  async markPaymentFailed(
    orderId: string,
    tx: Prisma.TransactionClient,
  ): Promise<boolean> {
    const result = await tx.order.updateMany({
      where: { id: orderId, status: OrderStatus.PENDING_PAYMENT },
      data: { status: OrderStatus.PAYMENT_FAILED },
    });
    if (result.count !== 1) {
      return false;
    }

    const order = tx.order?.findUnique
      ? await tx.order.findUnique({
          where: { id: orderId },
          select: { promotionId: true },
        })
      : null;
    await this.releaseOrderAdjustments(
      orderId,
      order?.promotionId ?? null,
      tx,
    );
    return true;
  }
}
