'use client';

import { useState, type FormEvent } from 'react';
import { api } from '../lib/api';

export function Auth() {
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const data = new FormData(e.currentTarget);
    const email = String(data.get('email') || '');
    const password = String(data.get('password') || '');

    if (new TextEncoder().encode(password).length > 72) {
      setError('Mật khẩu không được vượt quá 72 byte UTF-8');
      setBusy(false);
      return;
    }

    try {
      if (register) {
        await api('/auth/register', {
          method: 'POST',
          body: JSON.stringify({
            email,
            password,
            fullName: String(data.get('fullName') || ''),
          }),
        });
      }

      const result = await api<{
        accessToken: string;
        user: { role: string; fullName: string };
      }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      sessionStorage.setItem('brewlite-token', result.accessToken);
      sessionStorage.setItem('brewlite-user', JSON.stringify(result.user));
      const next = new URLSearchParams(window.location.search).get('next');
      window.location.href =
        next?.startsWith('/') && !next.startsWith('//') ? next : '/';
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <h1 style={{ fontSize: 36 }}>
        {register ? 'Một tài khoản, nhiều ly ngon.' : 'Chào bạn quay lại.'}
      </h1>
      <p>Đăng nhập để đặt món và theo dõi đơn của bạn.</p>

      <form onSubmit={submit}>
        {register && (
          <label>
            Họ tên
            <input
              name="fullName"
              minLength={2}
              maxLength={100}
              autoComplete="name"
              required
            />
          </label>
        )}

        <label>
          Email
          <input name="email" type="email" autoComplete="email" required />
        </label>

        <label>
          Mật khẩu
          <input
            name="password"
            type="password"
            minLength={8}
            maxLength={72}
            autoComplete={register ? 'new-password' : 'current-password'}
            required
          />
        </label>

        {register && (
          <p className="muted">Từ 8 ký tự, gồm chữ cái và chữ số.</p>
        )}
        {error && (
          <p role="alert" className="error notice">
            {error}
          </p>
        )}

        <button type="submit" disabled={busy}>
          {busy
            ? 'Đang xử lý…'
            : register
              ? 'Tạo tài khoản'
              : 'Đăng nhập'}
        </button>
      </form>

      <button
        type="button"
        className="textbutton"
        onClick={() => {
          setRegister(!register);
          setError('');
        }}
      >
        {register ? 'Đã có tài khoản? Đăng nhập' : 'Chưa có tài khoản? Đăng ký'}
      </button>
    </section>
  );
}
