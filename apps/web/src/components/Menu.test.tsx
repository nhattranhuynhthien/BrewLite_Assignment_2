import React from 'react';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { Menu } from './Menu';

vi.mock('next/link', () => ({
  default: ({
    children,
    ...props
  }: React.PropsWithChildren<{ href: string }>) => <a {...props}>{children}</a>,
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test('menu renders empty state clearly when catalog has no matches', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (url: string) => ({
      ok: true,
      json: async () =>
        String(url).includes('/categories') ? [] : { items: [], total: 0 },
    })),
  );

  render(<Menu />);
  await waitFor(() =>
    expect(screen.getByText(/Chưa có món phù hợp/)).toBeInTheDocument(),
  );
});

test('menu renders loading and retry button when network fails', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockRejectedValue(new Error('Mất kết nối máy chủ')),
  );

  render(<Menu />);
  expect(screen.getByRole('status')).toBeInTheDocument();
  await waitFor(() =>
    expect(screen.getByRole('alert')).toHaveTextContent('Mất kết nối máy chủ'),
  );
  expect(screen.getByRole('button', { name: 'Thử lại' })).toBeInTheDocument();
});

test('disables out-of-stock item selection and renders product image when provided', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (url: string) => ({
      ok: true,
      json: async () =>
        String(url).includes('/categories')
          ? [{ id: 'cat-1', name: 'Cà phê' }]
          : {
              items: [
                {
                  id: 'prod-1',
                  name: 'Cold Brew Cam',
                  description: 'Thanh mát',
                  imageUrl: 'https://cdn.example.com/cold-brew.jpg',
                  basePrice: 45000,
                  stockQuantity: 0,
                  category: { id: 'cat-1', name: 'Cà phê' },
                },
              ],
              total: 1,
            },
    })),
  );

  render(<Menu />);
  await waitFor(() =>
    expect(screen.getByText('Cold Brew Cam')).toBeInTheDocument(),
  );
  const productCard = screen.getByRole('article');
  const outOfStockBtn = within(productCard).getByRole('button', {
    name: 'Hết hàng',
  });
  expect(outOfStockBtn).toBeDisabled();
  expect(
    within(productCard).queryByRole('link'),
  ).not.toBeInTheDocument();
  expect(screen.getByAltText('Cold Brew Cam')).toHaveAttribute(
    'src',
    'https://cdn.example.com/cold-brew.jpg',
  );
});
