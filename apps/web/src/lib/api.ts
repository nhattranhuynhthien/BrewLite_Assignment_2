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
  basePrice: number;
  stockQuantity: number;
  category: Category;
  sizes?: { id: string; name: string; extraPrice: number }[];
  toppings?: { id: string; name: string; extraPrice: number }[];
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
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
    }
    const msg = Array.isArray(body.message)
      ? body.message.join('. ')
      : body.message || 'Không thể xử lý yêu cầu';
    throw new ApiError(response.status, msg);
  }

  return body as T;
}

export const money = (value: number): string =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(value);
