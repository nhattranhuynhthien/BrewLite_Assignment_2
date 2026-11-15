'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { money } from '../lib/api';
import { changeCart, readCart, type CartLine } from '../lib/cart';

export function Cart() {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const update = () => setLines(readCart());
    update();
    setReady(true);
    window.addEventListener('storage', update);
    window.addEventListener('brewlite-cart', update);
    return () => {
      window.removeEventListener('storage', update);
      window.removeEventListener('brewlite-cart', update);
    };
  }, []);

  async function updateQuantity(key: string, nextQty: number) {
    if (!Number.isInteger(nextQty) || nextQty < 0) {
      return;
    }
    try {
      await changeCart((current) =>
        current.flatMap((item) => {
          if (item.key !== key) {
            return [item];
          }
          if (nextQty > item.stock || nextQty > 50) {
            throw new Error('Số lượng vượt tồn kho hoặc giới hạn 50');
          }
          return nextQty > 0 ? [{ ...item, quantity: nextQty }] : [];
        }),
      );
      setError('');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!ready) {
    return <p role="status">Đang mở giỏ hàng…</p>;
  }

  const subtotal = lines.reduce(
    (sum, item) => sum + item.unitPrice * item.quantity,
    0,
  );

  return (
    <section className="panel">
      <h1 style={{ fontSize: 36 }}>Giỏ hàng của bạn</h1>
      {!lines.length ? (
        <div className="notice">
          Giỏ hàng đang trống.{' '}
          <Link className="empty-link" href="/">
            Chọn một ly nhé
          </Link>
        </div>
      ) : (
        <>
          {lines.map((item) => (
            <div className="line" key={item.key}>
              <div className="row">
                <div>
                  <h3>{item.name}</h3>
                  <p className="muted">
                    Size {item.sizeName} ·{' '}
                    {item.toppingNames.join(', ') || 'Không topping'}
                  </p>
                </div>
                <strong>{money(item.unitPrice * item.quantity)}</strong>
              </div>
              <div className="row">
                <label>
                  Số lượng
                  <input
                    aria-label={`Số lượng ${item.name}`}
                    type="number"
                    min={0}
                    max={Math.min(item.stock, 50)}
                    value={item.quantity}
                    onChange={(e) =>
                      void updateQuantity(item.key, Number(e.target.value))
                    }
                  />
                </label>
                <button
                  type="button"
                  className="textbutton"
                  onClick={() => void updateQuantity(item.key, 0)}
                >
                  Xóa món
                </button>
              </div>
            </div>
          ))}

          <div className="row">
            <h2>Tạm tính</h2>
            <strong className="price" data-testid="cart-subtotal">
              {money(subtotal)}
            </strong>
          </div>
          <p className="muted">
            Server kiểm tra lại giá và tồn kho trước khi tạo đơn.
          </p>
          <div className="actions">
            <Link className="button" href="/checkout">
              Đặt và thanh toán
            </Link>
            <button
              type="button"
              className="secondary"
              onClick={() => void changeCart(() => [])}
            >
              Làm trống giỏ
            </button>
          </div>
        </>
      )}

      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
