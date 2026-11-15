'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, money, type ValidatedPromotion } from '../lib/api';
import {
  changeCart,
  readCart,
  readSavedPromo,
  updateLineQuantity,
  writeSavedPromo,
  type CartLine,
} from '../lib/cart';

type PendingConfirm =
  | { type: 'remove'; key: string; name: string }
  | { type: 'clear' }
  | null;

export function Cart() {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm>(null);
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<ValidatedPromotion | null>(
    null,
  );
  const [promoError, setPromoError] = useState('');
  const [promoBusy, setPromoBusy] = useState(false);

  function resetPromo(clearInput: boolean) {
    setAppliedPromo(null);
    setPromoError('');
    if (clearInput) {
      setPromoInput('');
      writeSavedPromo();
    }
  }

  useEffect(() => {
    const update = () => setLines(readCart());
    update();
    const savedPromo = readSavedPromo();
    if (savedPromo) {
      setPromoInput(savedPromo);
    }
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
    if (nextQty === 0) {
      const target = lines.find((item) => item.key === key);
      if (target) {
        setPendingConfirm({ type: 'remove', key, name: target.name });
      }
      return;
    }
    try {
      await changeCart((current) => updateLineQuantity(current, key, nextQty));
      resetPromo(false);
      setError('');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function confirmRemoval() {
    if (!pendingConfirm) {
      return;
    }
    try {
      if (pendingConfirm.type === 'clear') {
        await changeCart(() => []);
        resetPromo(true);
      } else {
        const keyToRemove = pendingConfirm.key;
        const nextLines = await changeCart((current) =>
          updateLineQuantity(current, keyToRemove, 0),
        );
        resetPromo(nextLines.length === 0);
      }
      setPendingConfirm(null);
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

  async function applyPromo() {
    const code = promoInput.trim().toUpperCase();
    if (!code) {
      resetPromo(true);
      setPromoError('Vui lòng nhập mã khuyến mãi');
      return;
    }
    setPromoInput(code);
    setPromoBusy(true);
    setPromoError('');
    try {
      const result = await api<ValidatedPromotion>('/promotions/validate', {
        method: 'POST',
        body: JSON.stringify({ code, subtotal }),
      });
      setAppliedPromo(result);
      writeSavedPromo(result.code);
    } catch (err) {
      resetPromo(false);
      writeSavedPromo();
      setPromoError((err as Error).message);
    } finally {
      setPromoBusy(false);
    }
  }

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
          {lines.map((item, index) => {
            const otherVariantsQty = lines
              .filter(
                (other) =>
                  other.productId === item.productId && other.key !== item.key,
              )
              .reduce((sum, other) => sum + other.quantity, 0);
            const maxForLine = Math.max(
              item.quantity,
              Math.min(Math.max(0, item.stock - otherVariantsQty), 50),
            );
            return (
              <div className="line" key={item.key}>
                <div className="row" style={{ gap: 12, alignItems: 'center' }}>
                  <div
                    style={{
                      display: 'flex',
                      gap: 12,
                      alignItems: 'center',
                      flex: 1,
                    }}
                  >
                    <div
                      className={`product-art art-${index % 4}`}
                      aria-hidden={!item.imageUrl}
                      style={{
                        width: 64,
                        height: 64,
                        minHeight: 64,
                        borderRadius: 12,
                        flexShrink: 0,
                        overflow: 'hidden',
                        display: 'grid',
                        placeItems: 'center',
                        padding: item.imageUrl ? 0 : 8,
                      }}
                    >
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                          }}
                        />
                      ) : (
                        <div
                          className="mini-cup"
                          style={{ transform: 'scale(0.55)' }}
                        />
                      )}
                    </div>
                    <div>
                      <h3>{item.name}</h3>
                      <p className="muted">
                        Size {item.sizeName} ·{' '}
                        {item.toppingNames.join(', ') || 'Không topping'}
                      </p>
                      <p className="muted">
                        Đơn giá: {money(item.unitPrice)}
                      </p>
                    </div>
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
                      max={maxForLine}
                      value={item.quantity}
                      onChange={(e) =>
                        void updateQuantity(item.key, Number(e.target.value))
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="textbutton"
                    onClick={() =>
                      setPendingConfirm({
                        type: 'remove',
                        key: item.key,
                        name: item.name,
                      })
                    }
                  >
                    Xóa món
                  </button>
                </div>
              </div>
            );
          })}

          {pendingConfirm && (
            <div
              className="notice"
              role="dialog"
              aria-label="Xác nhận xóa khỏi giỏ hàng"
              style={{ marginTop: 14, marginBottom: 14 }}
            >
              <p style={{ margin: '0 0 10px' }}>
                {pendingConfirm.type === 'clear'
                  ? 'Bạn có chắc muốn xóa toàn bộ món trong giỏ hàng?'
                  : `Bạn có chắc muốn xóa "${pendingConfirm.name}" khỏi giỏ hàng?`}
              </p>
              <div className="actions">
                <button
                  type="button"
                  style={{ minHeight: 48 }}
                  onClick={() => void confirmRemoval()}
                >
                  {pendingConfirm.type === 'clear'
                    ? 'Xác nhận làm trống'
                    : 'Xác nhận xóa'}
                </button>
                <button
                  type="button"
                  className="secondary"
                  style={{ minHeight: 48 }}
                  onClick={() => setPendingConfirm(null)}
                >
                  Hủy
                </button>
              </div>
            </div>
          )}

          <div style={{ margin: '18px 0' }}>
            <label>
              Mã khuyến mãi
              <div className="row" style={{ gap: 8, alignItems: 'center' }}>
                <input
                  name="promoCode"
                  maxLength={50}
                  placeholder="BREWLITE10"
                  disabled={promoBusy}
                  value={promoInput}
                  style={{ marginBottom: 0, flex: 1 }}
                  onChange={(e) => {
                    setPromoInput(e.target.value);
                    setPromoError('');
                  }}
                />
                <button
                  type="button"
                  className="secondary"
                  style={{ minHeight: 48 }}
                  disabled={promoBusy}
                  onClick={() => void applyPromo()}
                >
                  {promoBusy ? 'Đang kiểm…' : 'Áp dụng mã'}
                </button>
              </div>
            </label>

            {appliedPromo && (
              <div
                className="notice row"
                style={{ padding: '10px 14px', margin: '8px 0' }}
              >
                <span>
                  Đã áp dụng <strong>{appliedPromo.code}</strong>: giảm{' '}
                  {money(appliedPromo.discountAmount)}
                </span>
                <button
                  type="button"
                  className="textbutton"
                  style={{ minHeight: 48 }}
                  onClick={() => resetPromo(true)}
                >
                  Bỏ mã
                </button>
              </div>
            )}

            {promoError && (
              <p
                role="alert"
                className="notice error"
                style={{ padding: '10px 14px' }}
              >
                {promoError}
              </p>
            )}
          </div>

          <div className="row">
            <h2>Tạm tính</h2>
            <strong className="price" data-testid="cart-subtotal">
              {money(subtotal)}
            </strong>
          </div>
          {appliedPromo && (
            <div className="row" style={{ marginTop: 6 }}>
              <span>Tạm tính sau giảm</span>
              <strong className="price" data-testid="cart-final-subtotal">
                {money(appliedPromo.finalSubtotal)}
              </strong>
            </div>
          )}
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
              style={{ minHeight: 48 }}
              onClick={() => setPendingConfirm({ type: 'clear' })}
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
