'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ApiError, api, money } from '../lib/api';
import { changeCart, readCart, type CartLine } from '../lib/cart';

type Draft = {
  orderId: string;
  key: string;
  method: 'WALLET' | 'CARD';
  lines: CartLine[];
};

const DRAFT_KEY = 'brewlite-checkout';

export function Checkout() {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [method, setMethod] = useState<'WALLET' | 'CARD'>('WALLET');
  const [scenario, setScenario] = useState('SUCCESS');
  const [note, setNote] = useState('');
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
  }, []);

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
        const order = await api<{ id: string }>('/orders', {
          method: 'POST',
          body: JSON.stringify({
            items: actual.map((item) => ({
              productId: item.productId,
              sizeId: item.sizeId,
              toppingIds: item.toppingIds,
              quantity: item.quantity,
            })),
            ...(note.trim() ? { note: note.trim() } : {}),
          }),
        });
        current = {
          orderId: order.id,
          key: crypto.randomUUID(),
          method,
          lines: actual,
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

  const shown = draft?.lines || lines;
  const total = shown.reduce((sum, x) => sum + x.unitPrice * x.quantity, 0);

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

      <p className="price">Tạm tính {money(total)}</p>

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
