import { Injectable } from '@nestjs/common';

@Injectable()
export class PricingService {
  calculateLine(
    basePrice: number,
    sizeExtraPrice: number,
    toppingExtraPrices: number[],
    quantity: number,
  ): { unitPrice: number; lineTotal: number } {
    const unitPrice =
      basePrice + sizeExtraPrice + toppingExtraPrices.reduce((total, price) => total + price, 0);
    return { unitPrice, lineTotal: unitPrice * quantity };
  }
}
