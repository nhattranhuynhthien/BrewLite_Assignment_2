'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  ApiError,
  api,
  money,
  type LoyaltySummary,
  type Promotion,
  type ValidatedPromotion,
} from '../lib/api';
import { changeCart, readCart, type CartLine } from '../lib/cart';

type Draft = {
  orderId: string;
  key: string;
  method: 'WALLET' | 'CARD';
  lines: CartLine[];
  discountAmount?: number;
  totalAmount?: number;
};

const DRAFT_KEY = 'brewlite-checkout';

function formatPromoLabel(promo: Promotion): string {
  return promo.discountType === 'PERCENT'
    ? `-${promo.discountValue}%`
    : `-${money(promo.discountValue)}`;
}

export function Checkout() {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [method, setMethod] = useState<'WALLET' | 'CARD'>('WALLET');
  const [scenario, setScenario] = useState('SUCCESS');
  const [note, setNote] = useState('');
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [promoInput, setPromoInput] = useState('');
  const [appliedPromo, setAppliedPromo] = useState<ValidatedPromotion | null>(
    null,
  );
  const [promoError, setPromoError] = useState('');
  const [promoBusy, setPromoBusy] = useState(false);
  const [loyalty, setLoyalty] = useState<LoyaltySummary | null>(null);
  const [redeemPoints, setRedeemPoints] = useState(0);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false);
  const [ready, setReady] = useState(false);
  const lock = useRef(false);

  useEffect(() => {
    if (!sessionStorage.getItem('brewlite-token')) {
      window.location.href = '/login?next=/checkout';
      return;
    }
    setLines(readCart());
    try {
      const saved = JSON.parse(
        sessionStorage.getItem(DRAFT_KEY) || 'null',
      ) as Draft | null;
      if (saved) {
        setDraft(saved);
        setMethod(saved.method);
      }
    } catch {
      sessionStorage.removeItem(DRAFT_KEY);
    }
    setReady(true);

    void Promise.allSettled([
      api<Promotion[]>('/promotions'),
      api<LoyaltySummary>('/loyalty/me'),
    ]).then(([promoRes, loyaltyRes]) => {
      if (promoRes.status === 'fulfilled') {
        setPromotions(promoRes.value);
      }
      if (loyaltyRes.status === 'fulfilled') {
        setLoyalty(loyaltyRes.value);
      }
    });
  }, []);

  const shown = draft?.lines || lines;
  const total = shown.reduce((sum, x) => sum + x.unitPrice * x.quantity, 0);
  const pointValueVnd = loyalty?.pointValueVnd ?? 1000;
  const promoDiscount = appliedPromo?.discountAmount ?? 0;
  const remainingAfterPromo = Math.max(0, total - promoDiscount);
  const maxUsablePoints = loyalty
    ? Math.min(loyalty.balance, Math.floor(remainingAfterPromo / pointValueVnd))
    : 0;
  const effectiveRedeemPoints = Math.min(redeemPoints, maxUsablePoints);
  const loyaltyDiscount = effectiveRedeemPoints * pointValueVnd;
  const previewDiscount = promoDiscount + loyaltyDiscount;
  const displayedDiscount = draft?.discountAmount ?? previewDiscount;
  const displayedFinalTotal =
    draft?.totalAmount ?? Math.max(0, total - displayedDiscount);

  async function applyPromo(codeOverride?: string) {
    const code = (codeOverride ?? promoInput).trim().toUpperCase();
    if (!code) {
      setAppliedPromo(null);
      setPromoError('Vui lòng nhập mã khuyến mãi');
      return;
    }
    if (codeOverride) {
      setPromoInput(code);
    }
    setPromoBusy(true);
    setPromoError('');
    try {
      const result = await api<ValidatedPromotion>('/promotions/validate', {
        method: 'POST',
        body: JSON.stringify({ code, subtotal: total }),
      });
      setAppliedPromo(result);
    } catch (err) {
      setAppliedPromo(null);
      setPromoError((err as Error).message);
    } finally {
      setPromoBusy(false);
    }
  }

  async function pay() {
    if (lock.current) {
      return;
    }
    lock.current = true;
    setBusy(true);
    setError('');
    let current = draft;

    try {
      if (!current) {
        const actual = readCart();
        if (!actual.length) {
          throw new Error('Giỏ hàng đang trống');
        }
        const order = await api<{
          id: string;
          discountAmount?: number;
          totalAmount?: number;
        }>('/orders', {
          method: 'POST',
          body: JSON.stringify({
            items: actual.map((item) => ({
              productId: item.productId,
              sizeId: item.sizeId,
              toppingIds: item.toppingIds,
              quantity: item.quantity,
            })),
            ...(note.trim() ? { note: note.trim() } : {}),
            ...(appliedPromo ? { promoCode: appliedPromo.code } : {}),
            ...(effectiveRedeemPoints > 0
              ? { redeemPoints: effectiveRedeemPoints }
              : {}),
          }),
        });
        current = {
          orderId: order.id,
          key: crypto.randomUUID(),
          method,
          lines: actual,
          discountAmount: order.discountAmount,
          totalAmount: order.totalAmount,
        };
        sessionStorage.setItem(DRAFT_KEY, JSON.stringify(current));
        setDraft(current);
      }

      const result = await api<{ status: string }>('/payments', {
        method: 'POST',
        headers: { 'Idempotency-Key': current.key },
        body: JSON.stringify({
          orderId: current.orderId,
          method: current.method,
          scenario,
        }),
      });

      if (result.status === 'SUCCESS') {
        const bought = current.lines;
        await changeCart((cart) =>
          cart.flatMap((x) => {
            const count = bought.find((b) => b.key === x.key)?.quantity || 0;
            return x.quantity > count
              ? [{ ...x, quantity: x.quantity - count }]
              : [];
          }),
        );
        sessionStorage.removeItem(DRAFT_KEY);
        window.location.href = `/orders/${current.orderId}`;
      } else {
        setPending(true);
      }
    } catch (err) {
      const failure = err as ApiError;
      if (failure.status === 402) {
        sessionStorage.removeItem(DRAFT_KEY);
        setDraft(null);
        setError(
          'Thanh toán bị từ chối. Tồn kho được hoàn lại; giỏ được giữ để bạn tạo đơn mới.',
        );
      } else if (failure.status === 401) {
        window.location.href = '/login?next=/checkout';
      } else if (failure.status === 409) {
        setPending(true);
        setError(failure.message);
      } else {
        setError(
          failure.message +
            ' Nếu đã tạo đơn, hãy xem lịch sử đơn trước khi thử lại.',
        );
      }
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  if (!ready) {
    return <p role="status">Đang kiểm tra phiên đăng nhập…</p>;
  }

  return (
    <section className="panel">
      <h1 style={{ fontSize: 36 }}>Chốt ly ngon nhé.</h1>
      <p>Nhận tại quầy sau khi đơn chuyển sang “Sẵn sàng”.</p>

      {shown.map((x) => (
        <div className="line row" key={x.key}>
          <span>
            {x.quantity} × {x.name} ({x.sizeName})
          </span>
          <strong>{money(x.unitPrice * x.quantity)}</strong>
        </div>
      ))}

      <div style={{ margin: '18px 0' }}>
        <label>
          Mã khuyến mãi
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <input
              name="promoCode"
              maxLength={50}
              placeholder="BREWLITE10"
              disabled={!!draft || busy || promoBusy}
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
              disabled={!!draft || busy || promoBusy || !shown.length}
              onClick={() => void applyPromo()}
            >
              {promoBusy ? 'Đang kiểm…' : 'Áp dụng'}
            </button>
          </div>
        </label>

        {promotions.length > 0 && !draft && (
          <div className="choices" style={{ marginTop: 8, marginBottom: 8 }}>
            {promotions.map((promo) => (
              <button
                key={promo.id}
                type="button"
                className="secondary"
                style={{ minHeight: 36, padding: '6px 12px', fontSize: 13 }}
                disabled={busy || promoBusy}
                onClick={() => void applyPromo(promo.code)}
              >
                {promo.code} ({formatPromoLabel(promo)}
                {promo.minOrderAmount > 0
                  ? `, đơn từ ${money(promo.minOrderAmount)}`
                  : ''}
                )
              </button>
            ))}
          </div>
        )}

        {appliedPromo && (
          <div className="notice row" style={{ padding: '10px 14px', margin: '8px 0' }}>
            <span>
              Đã áp dụng <strong>{appliedPromo.code}</strong>: giảm{' '}
              {money(appliedPromo.discountAmount)}
            </span>
            {!draft && (
              <button
                type="button"
                className="textbutton"
                onClick={() => {
                  setAppliedPromo(null);
                  setPromoInput('');
                  setPromoError('');
                }}
              >
                Bỏ mã
              </button>
            )}
          </div>
        )}

        {promoError && (
          <p role="alert" className="notice error" style={{ padding: '10px 14px' }}>
            {promoError}
          </p>
        )}
      </div>

      {loyalty && (
        <div style={{ margin: '12px 0 18px' }}>
          <div className="row" style={{ gap: 8, alignItems: 'center' }}>
            <label style={{ flex: 1, marginBottom: 0 }}>
              Đổi điểm tích lũy (hiện có {loyalty.balance} điểm · 1 điểm ={' '}
              {money(pointValueVnd)})
              <input
                name="redeemPoints"
                type="number"
                min={0}
                max={maxUsablePoints}
                disabled={!!draft || busy || maxUsablePoints === 0}
                value={effectiveRedeemPoints}
                style={{ marginBottom: 0 }}
                onChange={(e) => {
                  const parsed = Math.max(
                    0,
                    Math.floor(Number(e.target.value) || 0),
                  );
                  setRedeemPoints(Math.min(parsed, maxUsablePoints));
                }}
              />
            </label>
            <button
              type="button"
              className="secondary"
              disabled={!!draft || busy || maxUsablePoints === 0}
              style={{ alignSelf: 'flex-end' }}
              onClick={() => setRedeemPoints(maxUsablePoints)}
            >
              Dùng tối đa
            </button>
          </div>
        </div>
      )}

      <p className="price">Tạm tính {money(total)}</p>

      {displayedDiscount > 0 && (
        <div style={{ marginBottom: 16 }}>
          {promoDiscount > 0 && !draft && (
            <div className="row muted">
              <span>Giảm khuyến mãi ({appliedPromo?.code})</span>
              <span>-{money(promoDiscount)}</span>
            </div>
          )}
          {loyaltyDiscount > 0 && !draft && (
            <div className="row muted">
              <span>Đổi {effectiveRedeemPoints} điểm tích lũy</span>
              <span>-{money(loyaltyDiscount)}</span>
            </div>
          )}
          <p className="price" data-testid="checkout-final-total">
            Tổng thanh toán {money(displayedFinalTotal)}
          </p>
        </div>
      )}

      <label>
        Ghi chú cho quầy
        <input
          name="note"
          maxLength={200}
          placeholder="Ít đá, ít ngọt…"
          disabled={!!draft || busy}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>

      <label>
        Thanh toán mô phỏng
        <select
          aria-label="Thanh toán mô phỏng"
          disabled={!!draft || busy}
          value={method}
          onChange={(e) => setMethod(e.target.value as 'WALLET' | 'CARD')}
        >
          <option value="WALLET">Ví mô phỏng</option>
          <option value="CARD">Thẻ mô phỏng</option>
        </select>
      </label>

      <label>
        Kết quả mô phỏng
        <select
          aria-label="Kết quả mô phỏng"
          disabled={!!draft || busy}
          value={scenario}
          onChange={(e) => setScenario(e.target.value)}
        >
          <option value="SUCCESS">Thành công</option>
          <option value="DECLINED">Bị từ chối</option>
          <option value="TIMEOUT_CHARGED">Chậm phản hồi, đã thanh toán</option>
          <option value="TIMEOUT_NOT_CHARGED">
            Chậm phản hồi, chưa thanh toán
          </option>
        </select>
      </label>

      <p className="hint muted">
        Đây là thanh toán mô phỏng. Không nhập thông tin thẻ hoặc ví thật.
      </p>

      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}

      {pending && draft ? (
        <div className="notice">
          Đơn đang xử lý. Không tạo giao dịch mới.{' '}
          <Link className="empty-link" href={`/orders/${draft.orderId}`}>
            Theo dõi kết quả
          </Link>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy || !shown.length}
          onClick={() => void pay()}
        >
          {busy
            ? 'Đang xử lý…'
            : draft
              ? 'Tiếp tục thanh toán đơn đã tạo'
              : 'Xác nhận đặt và thanh toán'}
        </button>
      )}

      <p>
        <Link className="empty-link" href="/orders">
          Xem các đơn của tôi
        </Link>
      </p>
    </section>
  );
}
