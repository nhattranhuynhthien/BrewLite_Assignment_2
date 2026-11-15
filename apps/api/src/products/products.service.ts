import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Product } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const PAGE_SIZE = 20;

function normalizeVietnamese(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u0110\u0111]/g, 'd')
    .toLowerCase()
    .trim();
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(page = 1, categoryId?: string, q?: string) {
    const where: Prisma.ProductWhereInput = {
      isAvailable: true,
      ...(categoryId ? { categoryId } : {}),
    };
    const all = await this.prisma.product.findMany({
      where,
      include: { category: true },
      orderBy: { name: 'asc' },
    });

    const normalizedQuery = q ? normalizeVietnamese(q) : '';
    const filtered = normalizedQuery
      ? all.filter((product) =>
          normalizeVietnamese(product.name).includes(normalizedQuery),
        )
      : all;

    return {
      items: filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
      total: filtered.length,
      page,
      pageSize: PAGE_SIZE,
    };
  }

  async detail(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, isAvailable: true },
      include: {
        category: true,
        sizes: { where: { isAvailable: true }, orderBy: { extraPrice: 'asc' } },
        toppings: { include: { topping: true } },
      },
    });
    if (!product) {
      throw new NotFoundException('Không tìm thấy sản phẩm');
    }

    return {
      ...product,
      toppings: product.toppings
        .filter((pt) => pt.topping.isAvailable)
        .map((pt) => pt.topping),
    };
  }

  async categories() {
    return this.prisma.category.findMany({
      orderBy: { displayOrder: 'asc' },
    });
  }

  async getProductForOrder(
    productId: string,
    tx: Prisma.TransactionClient,
  ): Promise<
    | (Product & {
        sizes: { id: string; name: string; extraPrice: number }[];
        toppings: {
          topping: {
            id: string;
            name: string;
            extraPrice: number;
            isAvailable: boolean;
          };
        }[];
      })
    | null
  > {
    return tx.product.findUnique({
      where: { id: productId },
      include: {
        sizes: {
          where: { isAvailable: true },
          select: { id: true, name: true, extraPrice: true },
        },
        toppings: {
          include: {
            topping: {
              select: {
                id: true,
                name: true,
                extraPrice: true,
                isAvailable: true,
              },
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
      where: {
        id: productId,
        isAvailable: true,
        stockQuantity: { gte: quantity },
      },
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
      quantities.set(
        item.productId,
        (quantities.get(item.productId) ?? 0) + item.quantity,
      );
    }

    for (const [productId, quantity] of [...quantities.entries()].sort(
      ([a], [b]) => a.localeCompare(b),
    )) {
      await tx.product.update({
        where: { id: productId },
        data: { stockQuantity: { increment: quantity } },
      });
    }
  }
}
