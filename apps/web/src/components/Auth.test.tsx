import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { Auth } from './Auth';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test('auth switches to registration without losing accessible labels', () => {
  render(<Auth />);
  fireEvent.click(
    screen.getByRole('button', { name: 'Chưa có tài khoản? Đăng ký' }),
  );
  expect(screen.getByLabelText('Họ tên')).toBeRequired();
  expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email');
  expect(
    screen.getByRole('button', { name: 'Tạo tài khoản' }),
  ).toBeInTheDocument();
});

test('rejects passwords exceeding 72 UTF-8 bytes client-side without calling fetch', async () => {
  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);

  render(<Auth />);
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: 'user@brewlite.local' },
  });
  // 25 Vietnamese multi-byte characters ("ệ" = 3 bytes UTF-8 => 75 bytes > 72)
  fireEvent.change(screen.getByLabelText('Mật khẩu'), {
    target: { value: 'ệ'.repeat(25) },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }));

  await waitFor(() =>
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Mật khẩu không được vượt quá 72 byte UTF-8',
    ),
  );
  expect(fetchMock).not.toHaveBeenCalled();
});
