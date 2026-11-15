export type CartLine = {
  key: string;
  productId: string;
  sizeId: string;
  toppingIds: string[];
  name: string;
  imageUrl?: string | null;
  sizeName: string;
  toppingNames: string[];
  unitPrice: number;
  quantity: number;
  stock: number;
};

export const CART_KEY = 'brewlite_cart';
export const PROMO_CODE_KEY = 'brewlite-promo-code';

export function readSavedPromo(): string {
  if (typeof window === 'undefined') {
    return '';
  }
  try {
    return sessionStorage.getItem(PROMO_CODE_KEY) ?? '';
  } catch {
    return '';
  }
}

export function writeSavedPromo(code?: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    if (code) {
      sessionStorage.setItem(PROMO_CODE_KEY, code);
    } else {
      sessionStorage.removeItem(PROMO_CODE_KEY);
    }
  } catch {
    // Ignore storage access failures.
  }
}

export function lineKey(
  productId: string,
  sizeId: string,
  toppingIds: string[],
): string {
  return [productId, sizeId, ...[...toppingIds].sort()].join(':');
}

export function validLines(raw: unknown): CartLine[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter(
    (x): x is CartLine =>
      !!x &&
      typeof x.key === 'string' &&
      typeof x.productId === 'string' &&
      typeof x.sizeId === 'string' &&
      Array.isArray(x.toppingIds) &&
      typeof x.name === 'string' &&
      typeof x.sizeName === 'string' &&
      Array.isArray(x.toppingNames) &&
      Number.isInteger(x.quantity) &&
      x.quantity > 0 &&
      x.quantity <= 50 &&
      Number.isFinite(x.unitPrice) &&
      x.unitPrice >= 0 &&
      Number.isInteger(x.stock) &&
      x.stock >= 0,
  );
}

export function readCart(): CartLine[] {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const raw =
      localStorage.getItem(CART_KEY) ??
      localStorage.getItem('brewlite-cart-v1') ??
      '[]';
    return validLines(JSON.parse(raw));
  } catch {
    return [];
  }
}

export async function changeCart(
  fn: (lines: CartLine[]) => CartLine[],
): Promise<CartLine[]> {
  const update = () => {
    const next = fn(readCart());
    localStorage.setItem(CART_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event('brewlite-cart'));
    return next;
  };
  return typeof navigator !== 'undefined' && navigator.locks
    ? navigator.locks.request(CART_KEY, update)
    : update();
}

function assertWithinStockLimit(
  lines: CartLine[],
  productId: string,
  excludeKey: string,
  quantity: number,
  stock: number,
): void {
  const otherVariantsQty = lines
    .filter((x) => x.productId === productId && x.key !== excludeKey)
    .reduce((sum, x) => sum + x.quantity, 0);
  if (quantity > 50 || otherVariantsQty + quantity > stock) {
    throw new Error('Số lượng vượt tồn kho hoặc giới hạn 50');
  }
}

export function addLine(lines: CartLine[], line: CartLine): CartLine[] {
  const previous = lines.find((x) => x.key === line.key);
  const quantity = (previous?.quantity || 0) + line.quantity;
  assertWithinStockLimit(lines, line.productId, line.key, quantity, line.stock);
  return [...lines.filter((x) => x.key !== line.key), { ...line, quantity }];
}

export function updateLineQuantity(
  lines: CartLine[],
  key: string,
  nextQty: number,
): CartLine[] {
  return lines.flatMap((item) => {
    if (item.key !== key) {
      return [item];
    }
    if (nextQty === 0) {
      return [];
    }
    assertWithinStockLimit(
      lines,
      item.productId,
      item.key,
      nextQty,
      item.stock,
    );
    return [{ ...item, quantity: nextQty }];
  });
}
