import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { CART_KEY } from '../lib/cart';
import { Checkout } from './Checkout';

vi.mock('next/link', () => ({
  default: ({
    children,
    ...props
  }: React.PropsWithChildren<{ href: string }>) => <a {...props}>{children}</a>,
}));

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test('validates promo code, redeems loyalty points, and submits discounted order', async () => {
  sessionStorage.setItem('brewlite-token', 'tok-cust');
  localStorage.setItem(
    CART_KEY,
    JSON.stringify([
      {
        key: 'p1:s1',
        productId: 'p1',
        sizeId: 's1',
        toppingIds: [],
        name: 'Cà phê sữa đá',
        sizeName: 'M',
        toppingNames: [],
        unitPrice: 41000,
        quantity: 1,
        stock: 5,
      },
    ]),
  );

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/promotions')) {
      return {
        ok: true,
        json: async () => [
          {
            id: 'promo-1',
            code: 'BREWLITE10',
            discountType: 'PERCENT',
            discountValue: 10,
            minOrderAmount: 30000,
            startsAt: '2025-01-01T00:00:00.000Z',
            endsAt: '2030-12-31T23:59:59.000Z',
            usageLimit: null,
            usedCount: 0,
          },
        ],
      };
    }
    if (url.endsWith('/loyalty/me')) {
      return {
        ok: true,
        json: async () => ({
          balance: 10,
          pointValueVnd: 1000,
          earnUnitVnd: 10000,
          transactions: [],
        }),
      };
    }
    if (url.endsWith('/promotions/validate')) {
      return {
        ok: true,
        json: async () => ({
          valid: true,
          promotionId: 'promo-1',
          code: 'BREWLITE10',
          discountType: 'PERCENT',
          discountValue: 10,
          minOrderAmount: 30000,
          discountAmount: 4100,
          finalSubtotal: 36900,
        }),
      };
    }
    if (url.endsWith('/orders') && init?.method === 'POST') {
      return {
        ok: true,
        json: async () => ({
          id: 'order-123',
          subtotal: 41000,
          discountAmount: 14100,
          totalAmount: 26900,
        }),
      };
    }
    if (url.endsWith('/payments') && init?.method === 'POST') {
      return {
        ok: true,
        json: async () => ({ status: 'PENDING' }),
      };
    }
    throw new Error(`Unexpected fetch ${url}`);
  });
  vi.stubGlobal('fetch', fetchMock);

  render(<Checkout />);

  await waitFor(() =>
    expect(screen.getByText(/Tạm tính 41\.000/)).toBeInTheDocument(),
  );
  await waitFor(() =>
    expect(screen.getByText(/hiện có 10 điểm/)).toBeInTheDocument(),
  );

  const promoBtn = screen.getByRole('button', { name: /BREWLITE10/ });
  expect(promoBtn).toHaveStyle({ minHeight: '48px' });
  fireEvent.click(promoBtn);

  await waitFor(() =>
    expect(screen.getByText(/Đã áp dụng/)).toBeInTheDocument(),
  );

  fireEvent.click(screen.getByRole('button', { name: 'Dùng tối đa' }));

  expect(screen.getByTestId('checkout-final-total')).toHaveTextContent(
    '26.900',
  );

  fireEvent.click(
    screen.getByRole('button', { name: 'Xác nhận đặt và thanh toán' }),
  );

  await waitFor(() =>
    expect(screen.getByText(/Đơn đang xử lý/)).toBeInTheDocument(),
  );

  const orderCall = fetchMock.mock.calls.find(([url]) =>
    String(url).endsWith('/orders'),
  );
  expect(orderCall).toBeDefined();
  expect(JSON.parse(String(orderCall![1]?.body))).toMatchObject({
    promoCode: 'BREWLITE10',
    redeemPoints: 10,
  });
});

test('clears stale draft on non-IDEMPOTENCY_IN_PROGRESS 409 error so user can retry ordering', async () => {
  sessionStorage.setItem('brewlite-token', 'tok-cust');
  localStorage.setItem(
    CART_KEY,
    JSON.stringify([
      {
        key: 'p1:s1',
        productId: 'p1',
        sizeId: 's1',
        toppingIds: [],
        name: 'Bạc xỉu',
        sizeName: 'M',
        toppingNames: [],
        unitPrice: 40000,
        quantity: 1,
        stock: 5,
      },
    ]),
  );

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/promotions')) {
        return { ok: true, json: async () => [] };
      }
      if (url.endsWith('/loyalty/me')) {
        return {
          ok: true,
          json: async () => ({
            balance: 0,
            pointValueVnd: 1000,
            earnUnitVnd: 10000,
            transactions: [],
          }),
        };
      }
      if (url.endsWith('/orders') && init?.method === 'POST') {
        return {
          ok: true,
          json: async () => ({ id: 'order-409', discountAmount: 0, totalAmount: 40000 }),
        };
      }
      if (url.endsWith('/payments') && init?.method === 'POST') {
        return {
          ok: false,
          status: 409,
          json: async () => ({
            code: 'ORDER_NOT_PAYABLE',
            message: 'Đơn hàng đã hết hạn chờ thanh toán',
          }),
        };
      }
      throw new Error(`Unexpected fetch ${url}`);
    }),
  );

  render(<Checkout />);
  await waitFor(() =>
    expect(screen.getByText(/Tạm tính 40\.000/)).toBeInTheDocument(),
  );

  fireEvent.click(
    screen.getByRole('button', { name: 'Xác nhận đặt và thanh toán' }),
  );

  await waitFor(() =>
    expect(screen.getByRole('alert')).toHaveTextContent(
      /Đơn nháp đã được xóa để bạn tạo đơn mới/,
    ),
  );
  expect(sessionStorage.getItem('brewlite-checkout')).toBeNull();
  expect(screen.queryByText(/Đơn đang xử lý/)).not.toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Xác nhận đặt và thanh toán' }),
  ).toBeInTheDocument();
});
