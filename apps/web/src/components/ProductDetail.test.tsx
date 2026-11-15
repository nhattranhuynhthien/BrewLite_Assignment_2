import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { ProductDetail } from './ProductDetail';

vi.mock('next/link', () => ({
  default: ({
    children,
    ...props
  }: React.PropsWithChildren<{ href: string }>) => <a {...props}>{children}</a>,
}));

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

test('updates preview price on size/topping selection and persists into brewlite_cart', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'p1',
        name: 'Cà phê sữa đá',
        description: 'Đậm vị',
        basePrice: 30000,
        stockQuantity: 10,
        category: { id: 'c1', name: 'Cà phê' },
        sizes: [
          { id: 's1', name: 'S', extraPrice: 0 },
          { id: 's2', name: 'M', extraPrice: 5000 },
        ],
        toppings: [{ id: 't1', name: 'Trân châu trắng', extraPrice: 6000 }],
      }),
    }),
  );

  render(<ProductDetail id="p1" />);
  await waitFor(() =>
    expect(screen.getByRole('heading', { name: 'Cà phê sữa đá' })).toBeInTheDocument(),
  );

  expect(screen.getByTestId('dynamic-price')).toHaveTextContent('30.000');

  fireEvent.click(screen.getByRole('radio', { name: /M / }));
  fireEvent.click(screen.getByRole('checkbox', { name: /Trân châu trắng/ }));
  expect(screen.getByTestId('dynamic-price')).toHaveTextContent('41.000');

  fireEvent.click(screen.getByRole('button', { name: 'Thêm vào giỏ' }));
  await waitFor(() =>
    expect(screen.getByText(/Đã thêm vào giỏ hàng/)).toBeInTheDocument(),
  );

  const saved = JSON.parse(localStorage.getItem('brewlite_cart') || '[]');
  expect(saved).toHaveLength(1);
  expect(saved[0].unitPrice).toBe(41000);
});
