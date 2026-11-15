import type { Category, LoyaltySummary, Product, Promotion } from './api';

export const MOCK_CATEGORIES: Category[] = [
  { id: 'cat-coffee', name: 'Cà phê', displayOrder: 1 },
  { id: 'cat-tea', name: 'Trà trái cây & Trà sữa', displayOrder: 2 },
];

export const MOCK_PRODUCTS: Product[] = [
  {
    id: '10000000-0000-4000-8000-000000000001',
    name: 'Cà phê sữa đá',
    description: 'Cà phê phin rang mộc pha sữa đặc thơm béo.',
    basePrice: 30000,
    stockQuantity: 100,
    category: MOCK_CATEGORIES[0],
    sizes: [
      { id: 'size-1-s', name: 'S', extraPrice: 0 },
      { id: 'size-1-m', name: 'M', extraPrice: 5000 },
      { id: 'size-1-l', name: 'L', extraPrice: 10000 },
    ],
    toppings: [{ id: 'top-pearl', name: 'Trân châu trắng', extraPrice: 6000 }],
  },
  {
    id: '10000000-0000-4000-8000-000000000004',
    name: 'Trà đào cam sả',
    description: 'Trà ô long thanh mát kết hợp đào miếng giòn ngọt.',
    basePrice: 42000,
    stockQuantity: 100,
    category: MOCK_CATEGORIES[1],
    sizes: [
      { id: 'size-4-s', name: 'S', extraPrice: 0 },
      { id: 'size-4-m', name: 'M', extraPrice: 5000 },
    ],
    toppings: [{ id: 'top-pearl', name: 'Trân châu trắng', extraPrice: 6000 }],
  },
];

export const MOCK_PROMOTIONS: Promotion[] = [
  {
    id: 'promo-brewlite10',
    code: 'BREWLITE10',
    discountType: 'PERCENT',
    discountValue: 10,
    minOrderAmount: 30000,
    startsAt: '2025-01-01T00:00:00.000Z',
    endsAt: '2030-12-31T23:59:59.000Z',
    usageLimit: null,
    usedCount: 0,
  },
  {
    id: 'promo-giam15k',
    code: 'GIAM15K',
    discountType: 'FIXED_AMOUNT',
    discountValue: 15000,
    minOrderAmount: 60000,
    startsAt: '2025-01-01T00:00:00.000Z',
    endsAt: '2030-12-31T23:59:59.000Z',
    usageLimit: 500,
    usedCount: 0,
  },
];

export const MOCK_LOYALTY: LoyaltySummary = {
  balance: 15,
  pointValueVnd: 1000,
  earnUnitVnd: 10000,
  transactions: [],
};

export function handleMockRequest<T>(path: string): T | null {
  const url = new URL(path, 'http://mock.local');
  if (url.pathname === '/categories') {
    return MOCK_CATEGORIES as T;
  }
  if (url.pathname === '/promotions') {
    return MOCK_PROMOTIONS as T;
  }
  if (url.pathname === '/loyalty/me') {
    return MOCK_LOYALTY as T;
  }
  if (url.pathname === '/products') {
    const q = (url.searchParams.get('q') || '').toLowerCase().trim();
    const categoryId = url.searchParams.get('categoryId') || '';
    const items = MOCK_PRODUCTS.filter(
      (p) =>
        (!categoryId || p.category.id === categoryId) &&
        (!q || p.name.toLowerCase().includes(q)),
    );
    return { items, total: items.length, page: 1, pageSize: 20 } as T;
  }
  if (url.pathname.startsWith('/products/')) {
    const id = url.pathname.replace('/products/', '');
    const product = MOCK_PRODUCTS.find((p) => p.id === id);
    if (!product) {
      throw new Error('Không tìm thấy sản phẩm');
    }
    return product as T;
  }
  return null;
}
