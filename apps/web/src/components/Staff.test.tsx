import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { Staff } from './Staff';

vi.mock('next/link', () => ({
  default: ({
    children,
    ...props
  }: React.PropsWithChildren<{ href: string }>) => <a {...props}>{children}</a>,
}));

afterEach(() => {
  cleanup();
  sessionStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

test('prompts login when unauthenticated', async () => {
  render(<Staff />);
  await waitFor(() =>
    expect(screen.getByText(/Đăng nhập nhân viên/)).toBeInTheDocument(),
  );
  expect(screen.getByRole('link', { name: 'Đăng nhập nhân viên' })).toHaveAttribute(
    'href',
    '/login?next=/staff',
  );
});

test('blocks non-staff user cleanly', async () => {
  sessionStorage.setItem('brewlite-token', 'tok-customer');
  sessionStorage.setItem(
    'brewlite-user',
    JSON.stringify({ role: 'CUSTOMER', fullName: 'Khách' }),
  );

  render(<Staff />);
  await waitFor(() =>
    expect(
      screen.getByText(/Chỉ tài khoản nhân viên mới có quyền truy cập/),
    ).toBeInTheDocument(),
  );
});

test('loads staff queue and advances order status via PATCH /orders/:id/status', async () => {
  sessionStorage.setItem('brewlite-token', 'tok-staff');
  sessionStorage.setItem(
    'brewlite-user',
    JSON.stringify({ role: 'STAFF', fullName: 'Nhân viên Quầy' }),
  );

  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
          status: 'PAID',
          createdAt: '2026-11-15T10:00:00.000Z',
          totalAmount: 41000,
          note: 'Ít đá',
          items: [
            {
              id: 'item-1',
              productName: 'Cà phê sữa đá',
              sizeName: 'M',
              quantity: 1,
              lineTotal: 41000,
              toppings: [{ toppingName: 'Trân châu trắng' }],
            },
          ],
        },
      ],
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
        status: 'PREPARING',
      }),
    });
  vi.stubGlobal('fetch', fetchMock);

  render(<Staff />);

  await waitFor(() =>
    expect(screen.getByText(/Đơn #aaaaaaaa/)).toBeInTheDocument(),
  );
  expect(screen.getByText(/Ít đá/)).toBeInTheDocument();
  expect(screen.getByText('Đã thanh toán')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu pha chế' }));

  await waitFor(() =>
    expect(screen.getByText('Đang pha chế')).toBeInTheDocument(),
  );
  expect(
    screen.getByRole('button', { name: 'Báo sẵn sàng nhận' }),
  ).toBeInTheDocument();

  expect(fetchMock).toHaveBeenLastCalledWith(
    expect.stringContaining('/orders/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee/status'),
    expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({ status: 'PREPARING', expectedStatus: 'PAID' }),
    }),
  );
});
