import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  PAID: OrderStatus.PREPARING,
  PREPARING: OrderStatus.READY,
  READY: OrderStatus.COMPLETED,
};

@Injectable()
export class OrderStatusService {
  constructor(private readonly db: PrismaService) {}

  listActiveForStaff() {
    return this.db.order.findMany({
      where: {
        status: {
          in: [OrderStatus.PAID, OrderStatus.PREPARING, OrderStatus.READY],
        },
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
      include: { items: { include: { toppings: true } } },
    });
  }

  async transition(
    id: string,
    targetStatus: OrderStatus,
    expectedStatus?: OrderStatus,
  ) {
    const order = await this.db.order.findUnique({ where: { id } });
    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng');
    }

    if (expectedStatus && expectedStatus !== order.status) {
      throw new ConflictException(
        'Trạng thái đơn đã thay đổi; vui lòng tải lại',
      );
    }

    if (NEXT_STATUS[order.status] !== targetStatus) {
      throw new BadRequestException(
        `Không thể chuyển trạng thái đơn từ ${order.status} sang ${targetStatus}`,
      );
    }

    const result = await this.db.order.updateMany({
      where: { id, status: order.status },
      data: { status: targetStatus },
    });
    if (result.count !== 1) {
      throw new ConflictException(
        'Trạng thái đơn vừa thay đổi; vui lòng tải lại',
      );
    }

    return this.db.order.findUnique({
      where: { id },
      include: { items: { include: { toppings: true } }, payments: true },
    });
  }
}
