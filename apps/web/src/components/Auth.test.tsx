import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { Auth } from './Auth';

afterEach(cleanup);

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
