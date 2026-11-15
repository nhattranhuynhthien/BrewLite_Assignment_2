import { getPublicApiUrl } from './env';
import { handleMockRequest } from './mock-data';

export const API = getPublicApiUrl();
export const IS_API_MOCK = process.env.NEXT_PUBLIC_API_MOCK === 'true';

export interface Category {
  id: string;
  name: string;
  displayOrder?: number;
}

export interface Product {
  id: string;
  name: string;
  description: string;
  imageUrl?: string | null;
  basePrice: number;
  stockQuantity: number;
  category: Category;
  sizes?: { id: string; name: string; extraPrice: number }[];
  toppings?: { id: string; name: string; extraPrice: number }[];
}

export interface Promotion {
  id: string;
  code: string;
  discountType: 'PERCENT' | 'FIXED_AMOUNT';
  discountValue: number;
  minOrderAmount: number;
  startsAt: string;
  endsAt: string;
  usageLimit: number | null;
  usedCount: number;
}

export interface ValidatedPromotion {
  valid: true;
  promotionId: string;
  code: string;
  discountType: 'PERCENT' | 'FIXED_AMOUNT';
  discountValue: number;
  minOrderAmount: number;
  discountAmount: number;
  finalSubtotal: number;
}

export interface LoyaltyTransaction {
  id: string;
  orderId: string | null;
  type: 'EARN' | 'REDEEM';
  points: number;
  createdAt: string;
}

export interface LoyaltySummary {
  balance: number;
  pointValueVnd: number;
  earnUnitVnd: number;
  transactions: LoyaltyTransaction[];
}

export interface OrderItem {
  id: string;
  productName: string;
  sizeName: string;
  quantity: number;
  lineTotal: number;
  toppings?: { toppingName: string }[];
}

export interface Order {
  id: string;
  status: string;
  createdAt: string;
  subtotal?: number;
  discountAmount?: number;
  totalAmount: number;
  note?: string | null;
  items: OrderItem[];
  payments?: { status: string }[];
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export async function api<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  if (IS_API_MOCK && (!init.method || init.method === 'GET')) {
    const mocked = handleMockRequest<T>(path);
    if (mocked !== null) {
      return mocked;
    }
  }

  const token =
    typeof window !== 'undefined'
      ? sessionStorage.getItem('brewlite-token')
      : null;

  const response = await fetch(API + path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  const body = await response
    .json()
    .catch(() => ({ message: 'Không đọc được phản hồi máy chủ' }));

  if (!response.ok) {
    if (response.status === 401 && typeof window !== 'undefined') {
      sessionStorage.removeItem('brewlite-token');
      sessionStorage.removeItem('brewlite-user');
    }
    const msg = Array.isArray(body.message)
      ? body.message.join('. ')
      : body.message || 'Không thể xử lý yêu cầu';
    const code = typeof body?.code === 'string' ? body.code : undefined;
    throw new ApiError(response.status, msg, code);
  }

  return body as T;
}

export const money = (value: number): string =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(value);
