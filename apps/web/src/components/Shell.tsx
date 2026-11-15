'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { readCart } from '../lib/cart';

export function Shell({ children }: { children: ReactNode }) {
  const [signed, setSigned] = useState(false);
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    const sync = () => {
      setSigned(!!sessionStorage.getItem('brewlite-token'));
      const totalItems = readCart().reduce((sum, item) => sum + item.quantity, 0);
      setCartCount(totalItems);
    };
    sync();
    window.addEventListener('storage', sync);
    window.addEventListener('brewlite-cart', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('brewlite-cart', sync);
    };
  }, []);

  function logout() {
    sessionStorage.removeItem('brewlite-token');
    sessionStorage.removeItem('brewlite-user');
    window.location.href = '/';
  }

  const cartLabel = cartCount > 0 ? `Giỏ hàng (${cartCount})` : 'Giỏ hàng';

  return (
    <>
      <header className="masthead">
        <Link className="brand" href="/">
          Brew<span>Lite</span>
          <small>Pha mới. Nhận tại quầy.</small>
        </Link>
        <nav aria-label="Điều hướng chính">
          <Link href="/">Thực đơn</Link>
          <Link href="/cart">{cartLabel}</Link>
          <Link href="/orders">Đơn của tôi</Link>
          {signed ? (
            <button type="button" className="textbutton" onClick={logout}>
              Đăng xuất
            </button>
          ) : (
            <Link href="/login">Đăng nhập</Link>
          )}
        </nav>
      </header>

      <main>{children}</main>

      <nav aria-label="Điều hướng di động" className="mobile-bottom-nav">
        <Link href="/">Thực đơn</Link>
        <Link href="/cart">{cartLabel}</Link>
        <Link href="/orders">Đơn của tôi</Link>
        {signed ? (
          <button type="button" onClick={logout}>
            Đăng xuất
          </button>
        ) : (
          <Link href="/login">Đăng nhập</Link>
        )}
      </nav>

      <footer>BrewLite — Một ly ngon, một khoảng nghỉ.</footer>
    </>
  );
}
