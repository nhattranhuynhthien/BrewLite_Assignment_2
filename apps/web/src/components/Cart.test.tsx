import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { Cart } from './Cart';
import { CART_KEY, PROMO_CODE_KEY } from '../lib/cart';

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

test('renders persisted items, unit price, and confirms before deleting', async () => {
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
        quantity: 2,
        stock: 5,
      },
    ]),
  );

  render(<Cart />);
  await waitFor(() => expect(screen.getByText('Bạc xỉu')).toBeInTheDocument());
  expect(screen.getByText(/Đơn giá: 40\.000/)).toBeInTheDocument();
  expect(screen.getByTestId('cart-subtotal')).toHaveTextContent('80.000');

  fireEvent.click(screen.getByRole('button', { name: 'Xóa món' }));
  expect(
    screen.getByRole('dialog', { name: 'Xác nhận xóa khỏi giỏ hàng' }),
  ).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));
  expect(screen.getByText('Bạc xỉu')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Xóa món' }));
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận xóa' }));
  await waitFor(() =>
    expect(screen.getByText(/Giỏ hàng đang trống/)).toBeInTheDocument(),
  );
});

test('confirms zero quantity or clear cart, validates promo code, and checks shared product stock', async () => {
  localStorage.setItem(
    CART_KEY,
    JSON.stringify([
      {
        key: 'p1:s',
        productId: 'p1',
        sizeId: 's',
        toppingIds: [],
        name: 'Cà phê sữa đá',
        sizeName: 'S',
        toppingNames: [],
        unitPrice: 30000,
        quantity: 3,
        stock: 5,
      },
      {
        key: 'p1:m',
        productId: 'p1',
        sizeId: 'm',
        toppingIds: [],
        name: 'Cà phê sữa đá',
        sizeName: 'M',
        toppingNames: [],
        unitPrice: 35000,
        quantity: 2,
        stock: 5,
      },
    ]),
  );

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith('/promotions/validate')) {
        return {
          ok: true,
          json: async () => ({
            valid: true,
            promotionId: 'promo-1',
            code: 'BREWLITE10',
            discountType: 'PERCENT',
            discountValue: 10,
            minOrderAmount: 30000,
            discountAmount: 16000,
            finalSubtotal: 144000,
          }),
        };
      }
      throw new Error(`Unexpected fetch ${String(input)}`);
    }),
  );

  render(<Cart />);
  await waitFor(() =>
    expect(screen.getByTestId('cart-subtotal')).toHaveTextContent('160.000'),
  );

  const qtyInputs = screen.getAllByLabelText('Số lượng Cà phê sữa đá');
  fireEvent.change(qtyInputs[1], { target: { value: '3' } });
  await waitFor(() =>
    expect(screen.getByRole('alert')).toHaveTextContent(
      /vượt tồn kho hoặc giới hạn 50/,
    ),
  );

  fireEvent.change(screen.getByPlaceholderText('BREWLITE10'), {
    target: { value: 'brewlite10' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Áp dụng mã' }));
  await waitFor(() =>
    expect(screen.getByTestId('cart-final-subtotal')).toHaveTextContent(
      '144.000',
    ),
  );
  expect(sessionStorage.getItem(PROMO_CODE_KEY)).toBe('BREWLITE10');

  fireEvent.change(qtyInputs[0], { target: { value: '0' } });
  expect(
    screen.getByRole('button', { name: 'Xác nhận xóa' }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));

  fireEvent.click(screen.getByRole('button', { name: 'Làm trống giỏ' }));
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận làm trống' }));
  await waitFor(() =>
    expect(screen.getByText(/Giỏ hàng đang trống/)).toBeInTheDocument(),
  );
  expect(sessionStorage.getItem(PROMO_CODE_KEY)).toBeNull();
});
