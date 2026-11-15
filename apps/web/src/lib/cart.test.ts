import { afterEach, describe, expect, test } from 'vitest';
import {
  CART_KEY,
  addLine,
  changeCart,
  lineKey,
  readCart,
  updateLineQuantity,
  validLines,
  type CartLine,
} from './cart';

const sampleLine: CartLine = {
  key: 'p:s',
  productId: 'p',
  sizeId: 's',
  toppingIds: [],
  name: 'Cà phê sữa đá',
  sizeName: 'M',
  toppingNames: [],
  unitPrice: 35000,
  quantity: 1,
  stock: 2,
};

afterEach(() => {
  localStorage.clear();
});

describe('cart store (brewlite_cart)', () => {
  test('uses canonical brewlite_cart storage key and merges duplicate lines safely', async () => {
    expect(CART_KEY).toBe('brewlite_cart');
    expect(addLine([sampleLine], sampleLine)[0].quantity).toBe(2);
    expect(() => addLine([{ ...sampleLine, quantity: 2 }], sampleLine)).toThrow();

    await changeCart(() => [sampleLine]);
    expect(JSON.parse(localStorage.getItem('brewlite_cart') || '[]')).toHaveLength(1);
    expect(readCart()).toHaveLength(1);
  });

  test('topping order does not split a cart line', () => {
    expect(lineKey('p', 's', ['b', 'a'])).toBe(lineKey('p', 's', ['a', 'b']));
  });

  test('corrupt persisted cart is discarded gracefully', () => {
    expect(validLines({ quantity: 1 })).toEqual([]);
    expect(validLines([{ ...sampleLine, quantity: -1 }])).toEqual([]);
    localStorage.setItem(CART_KEY, '{corrupt json');
    expect(readCart()).toEqual([]);
  });

  test('enforces total stock across multiple variants of the same product', () => {
    const variantA: CartLine = {
      ...sampleLine,
      key: 'p-shared:s',
      productId: 'p-shared',
      sizeId: 's',
      sizeName: 'S',
      quantity: 3,
      stock: 5,
    };
    const variantB: CartLine = {
      ...sampleLine,
      key: 'p-shared:m',
      productId: 'p-shared',
      sizeId: 'm',
      sizeName: 'M',
      quantity: 3,
      stock: 5,
    };
    expect(() => addLine([variantA], variantB)).toThrow(
      /vượt tồn kho hoặc giới hạn 50/,
    );
    expect(() =>
      updateLineQuantity([variantA, { ...variantB, quantity: 2 }], 'p-shared:m', 3),
    ).toThrow(/vượt tồn kho hoặc giới hạn 50/);
  });
});
