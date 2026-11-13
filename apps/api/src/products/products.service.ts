import { Injectable } from '@nestjs/common';
import { Prisma, Product } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async getProductForOrder(
    productId: string,
    tx: Prisma.TransactionClient,
  ): Promise<
    | (Product & {
        sizes: { id: string; name: string; extraPrice: number }[];
        toppings: { topping: { id: string; name: string; extraPrice: number; isAvailable: boolean } }[];
      })
    | null
  > {
    return tx.product.findUnique({
      where: { id: productId },
      include: {
        sizes: { select: { id: true, name: true, extraPrice: true } },
        toppings: {
          include: {
            topping: {
              select: { id: true, name: true, extraPrice: true, isAvailable: true },
            },
          },
        },
      },
    });
  }

  async decreaseStock(
    productId: string,
    quantity: number,
    tx: Prisma.TransactionClient,
  ): Promise<boolean> {
    const result = await tx.product.updateMany({
      where: { id: productId, isAvailable: true, stockQuantity: { gte: quantity } },
      data: { stockQuantity: { decrement: quantity } },
    });
    return result.count === 1;
  }

  async restoreStock(
    items: { productId: string; quantity: number }[],
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const quantities = new Map<string, number>();
    for (const item of items) {
      quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
    }

    for (const [productId, quantity] of [...quantities.entries()].sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      await tx.product.update({
        where: { id: productId },
        data: { stockQuantity: { increment: quantity } },
      });
    }
  }
}
