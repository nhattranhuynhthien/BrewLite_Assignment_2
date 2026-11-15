'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, api, money } from '../lib/api';

export const STATUS: Record<string, string> = {
  PENDING_PAYMENT: 'Chờ thanh toán',
  PAID: 'Đã thanh toán',
  PAYMENT_FAILED: 'Thanh toán thất bại',
  PREPARING: 'Đang pha chế',
  READY: 'Sẵn sàng nhận',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã hủy',
};

export type Order = {
  id: string;
  status: string;
  createdAt: string;
  totalAmount: number;
  items: {
    id: string;
    productName: string;
    sizeName: string;
    quantity: number;
    lineTotal: number;
    toppings?: { toppingName: string }[];
  }[];
  payments?: { status: string }[];
};

const FINAL = ['PAYMENT_FAILED', 'CANCELLED', 'COMPLETED'];

export function Orders({ id }: { id?: string }) {
  const [items, setItems] = useState<Order[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const inflight = useRef(false);
  const terminal = useRef(false);

  const load = useCallback(async () => {
    if (inflight.current) {
      return;
    }
    inflight.current = true;
    try {
      if (id) {
        const order = await api<Order>(`/orders/${id}`);
        if (
          order.status === 'PENDING_PAYMENT' &&
          order.payments?.some((p) => p.status === 'PENDING')
        ) {
          await api(`/payments/${id}/status`).catch(() => {});
          const refreshed = await api<Order>(`/orders/${id}`);
          setItems([refreshed]);
          terminal.current = FINAL.includes(refreshed.status);
        } else {
          setItems([order]);
          terminal.current = FINAL.includes(order.status);
        }
      } else {
        const data = await api<{ items: Order[]; total: number }>(
          `/orders?page=${page}`,
        );
        setItems(data.items);
        setTotal(data.total);
        terminal.current =
          data.items.length > 0 &&
          data.items.every((o) => FINAL.includes(o.status));
      }
      setError('');
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.status === 401) {
        setItems([]);
        terminal.current = true;
      }
      setError(apiErr.message);
    } finally {
      inflight.current = false;
      setBusy(false);
    }
  }, [id, page]);

  useEffect(() => {
    terminal.current = false;
    void load();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible' && !terminal.current) {
        void load();
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [load]);

  return (
    <section className="panel">
      <h1 style={{ fontSize: 36 }}>{id ? 'Đơn của bạn' : 'Những ly đã đặt'}</h1>
      {busy && <p role="status">Đang tải đơn…</p>}

      {error && (
        <div role="alert" className="notice error">
          {error}
          <button type="button" onClick={() => void load()}>
            Tải lại
          </button>{' '}
          <Link className="empty-link" href="/login">
            Đăng nhập
          </Link>
        </div>
      )}

      {!busy && !error && !items.length && (
        <p className="notice">
          Bạn chưa có đơn nào.{' '}
          <Link className="empty-link" href="/">
            Chọn món
          </Link>
        </p>
      )}

      {items.map((o) => (
        <article key={o.id} className="order-card">
          <span className="badge">{STATUS[o.status] || o.status}</span>
          <h3>Đơn {o.id.slice(0, 8)}</h3>
          <p className="muted">
            {new Intl.DateTimeFormat('vi-VN', {
              dateStyle: 'medium',
              timeStyle: 'short',
              timeZone: 'Asia/Ho_Chi_Minh',
            }).format(new Date(o.createdAt))}
          </p>

          {o.items.map((x) => (
            <div className="line row" key={x.id}>
              <span>
                {x.quantity} × {x.productName} · {x.sizeName}
                {x.toppings?.length
                  ? ` · ${x.toppings.map((t) => t.toppingName).join(', ')}`
                  : ''}
              </span>
              <strong>{money(x.lineTotal)}</strong>
            </div>
          ))}

          <div className="row">
            <strong>{money(o.totalAmount)}</strong>
            {!id && (
              <Link className="button" href={`/orders/${o.id}`}>
                Xem đơn
              </Link>
            )}
          </div>

          {id && o.status === 'PAYMENT_FAILED' && (
            <p>
              Giỏ hàng được giữ.{' '}
              <Link className="empty-link" href="/cart">
                Tạo đơn mới
              </Link>
            </p>
          )}
          {id && o.status === 'PENDING_PAYMENT' && (
            <p className="muted">
              Đang chờ thanh toán hoặc đối soát. Trang tự cập nhật mỗi 5 giây.
            </p>
          )}
        </article>
      ))}

      {!id && (
        <div className="pager">
          <button
            type="button"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            Trang trước
          </button>
          <span>{page}</span>
          <button
            type="button"
            disabled={page * 20 >= total}
            onClick={() => setPage(page + 1)}
          >
            Trang sau
          </button>
        </div>
      )}
    </section>
  );
}
