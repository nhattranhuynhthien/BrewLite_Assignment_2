import { BadRequestException, Injectable } from '@nestjs/common';

@Injectable()
export class PricingService {
  calculateLine(
    basePrice: number,
    sizeExtraPrice: number,
    toppingExtraPrices: number[],
    quantity: number,
  ): { unitPrice: number; lineTotal: number } {
    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 50 ||
      [basePrice, sizeExtraPrice, ...toppingExtraPrices].some(
        (value) => !Number.isSafeInteger(value) || value < 0,
      )
    ) {
      throw new BadRequestException('Giá hoặc số lượng không hợp lệ');
    }

    const unitPrice =
      basePrice +
      sizeExtraPrice +
      toppingExtraPrices.reduce((sum, extra) => sum + extra, 0);
    const lineTotal = unitPrice * quantity;

    if (!Number.isSafeInteger(lineTotal) || lineTotal > 2147483647) {
      throw new BadRequestException('Giá trị đơn quá lớn');
    }

    return { unitPrice, lineTotal };
  }
}
