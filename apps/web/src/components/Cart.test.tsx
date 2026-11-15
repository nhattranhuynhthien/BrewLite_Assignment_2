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
import { CART_KEY } from '../lib/cart';

vi.mock('next/link', () => ({
  default: ({
    children,
    ...props
  }: React.PropsWithChildren<{ href: string }>) => <a {...props}>{children}</a>,
}));

afterEach(() => {
  cleanup();
  localStorage.clear();
});

test('renders persisted items from brewlite_cart and updates subtotal', async () => {
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
  expect(screen.getByTestId('cart-subtotal')).toHaveTextContent('80.000');

  fireEvent.click(screen.getByRole('button', { name: 'Xóa món' }));
  await waitFor(() =>
    expect(screen.getByText(/Giỏ hàng đang trống/)).toBeInTheDocument(),
  );
});
