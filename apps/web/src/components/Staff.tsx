'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, api, money, type Order } from '../lib/api';
import { STATUS } from './Orders';

type StaffAuthState = 'checking' | 'unauthenticated' | 'forbidden' | 'allowed';

const NEXT_ACTION: Record<
  string,
  { next: 'PREPARING' | 'READY' | 'COMPLETED'; label: string }
> = {
  PAID: { next: 'PREPARING', label: 'Bắt đầu pha chế' },
  PREPARING: { next: 'READY', label: 'Báo sẵn sàng nhận' },
  READY: { next: 'COMPLETED', label: 'Hoàn tất giao món' },
};

function readStoredRole(): string | null {
  try {
    const raw = sessionStorage.getItem('brewlite-user');
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as { role?: unknown };
    return typeof parsed.role === 'string' ? parsed.role : null;
  } catch {
    return null;
  }
}

export function Staff() {
  const [authState, setAuthState] = useState<StaffAuthState>('checking');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const inflight = useRef(false);

  const load = useCallback(async () => {
    if (inflight.current) {
      return;
    }
    inflight.current = true;
    try {
      const data = await api<Order[]>('/staff/orders');
      setOrders(data);
      setError('');
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.status === 401) {
        setAuthState('unauthenticated');
      } else if (apiErr.status === 403) {
        setAuthState('forbidden');
      } else {
        setError(apiErr.message);
      }
    } finally {
      inflight.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = sessionStorage.getItem('brewlite-token');
    if (!token) {
      setAuthState('unauthenticated');
      setLoading(false);
      return;
    }

    const role = readStoredRole();
    if (role && role !== 'STAFF') {
      setAuthState('forbidden');
      setLoading(false);
      return;
    }

    setAuthState('allowed');
    void load();

    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') {
        void load();
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [load]);

  async function advance(order: Order) {
    const transition = NEXT_ACTION[order.status];
    if (!transition || updatingId) {
      return;
    }
    setUpdatingId(order.id);
    setActionError('');
    try {
      const updated = await api<Order>(`/orders/${order.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: transition.next,
          expectedStatus: order.status,
        }),
      });
      setOrders((prev) =>
        updated.status === 'COMPLETED'
          ? prev.filter((item) => item.id !== order.id)
          : prev.map((item) =>
              item.id === order.id ? { ...item, status: updated.status } : item,
            ),
      );
    } catch (err) {
      const apiErr = err as ApiError;
      if (apiErr.status === 409) {
        setActionError(
          `Đơn ${order.id.slice(0, 8)} vừa được cập nhật ở nơi khác, đang tải lại danh sách.`,
        );
        void load();
      } else if (apiErr.status === 401) {
        setAuthState('unauthenticated');
      } else if (apiErr.status === 403) {
        setAuthState('forbidden');
      } else {
        setActionError(apiErr.message);
      }
    } finally {
      setUpdatingId(null);
    }
  }

  if (authState === 'checking') {
    return (
      <section className="panel wide">
        <p role="status">Đang kiểm tra quyền truy cập quầy pha chế…</p>
      </section>
    );
  }

  if (authState === 'unauthenticated') {
    return (
      <section className="panel">
        <h1 style={{ fontSize: 36 }}>Quầy pha chế</h1>
        <p className="notice">
          Vui lòng đăng nhập bằng tài khoản nhân viên để xem hàng đợi pha chế.
        </p>
        <Link className="button" href="/login?next=/staff">
          Đăng nhập nhân viên
        </Link>
      </section>
    );
  }

  if (authState === 'forbidden') {
    return (
      <section className="panel">
        <h1 style={{ fontSize: 36 }}>Quầy pha chế</h1>
        <p role="alert" className="notice error">
          Chỉ tài khoản nhân viên mới có quyền truy cập màn hình quầy pha chế.
        </p>
        <div className="actions">
          <Link className="button secondary" href="/">
            Về thực đơn
          </Link>
          <Link className="button" href="/login?next=/staff">
            Đăng nhập tài khoản khác
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="panel wide">
      <div className="row" style={{ marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 36, marginBottom: 4 }}>Quầy pha chế</h1>
          <p className="muted" style={{ margin: 0 }}>
            Đơn hàng đã thanh toán đang chờ xử lý (tự cập nhật mỗi 5 giây).
          </p>
        </div>
        <button
          type="button"
          className="secondary"
          disabled={loading}
          onClick={() => void load()}
        >
          Làm mới
        </button>
      </div>

      {loading && <p role="status">Đang tải hàng đợi pha chế…</p>}

      {error && (
        <div role="alert" className="notice error">
          {error}
          <button type="button" onClick={() => void load()}>
            Thử lại
          </button>
        </div>
      )}

      {actionError && (
        <p role="alert" className="notice error">
          {actionError}
        </p>
      )}

      {!loading && !error && !orders.length && (
        <p className="notice">
          Hiện chưa có đơn nào cần pha chế hoặc trả món.
        </p>
      )}

      {orders.map((order) => {
        const action = NEXT_ACTION[order.status];
        return (
          <article key={order.id} className="order-card">
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <div>
                <span className="badge">{STATUS[order.status] || order.status}</span>
                <h2 style={{ margin: '8px 0 4px', fontSize: 22 }}>
                  Đơn #{order.id.slice(0, 8)}
                </h2>
                <p className="muted" style={{ margin: 0 }}>
                  {new Intl.DateTimeFormat('vi-VN', {
                    dateStyle: 'short',
                    timeStyle: 'short',
                    timeZone: 'Asia/Ho_Chi_Minh',
                  }).format(new Date(order.createdAt))}
                </p>
              </div>
              {action && (
                <button
                  type="button"
                  disabled={updatingId === order.id}
                  onClick={() => void advance(order)}
                >
                  {updatingId === order.id ? 'Đang cập nhật…' : action.label}
                </button>
              )}
            </div>

            {order.items.map((item) => (
              <div className="line row" key={item.id}>
                <span>
                  {item.quantity} × {item.productName} · {item.sizeName}
                  {item.toppings?.length
                    ? ` · ${item.toppings.map((t) => t.toppingName).join(', ')}`
                    : ''}
                </span>
                <strong>{money(item.lineTotal)}</strong>
              </div>
            ))}

            {order.note && (
              <p className="hint" style={{ marginTop: 12, marginBottom: 4 }}>
                <strong>Ghi chú:</strong> {order.note}
              </p>
            )}

            <div className="row" style={{ marginTop: 10 }}>
              <span className="muted">Tổng thanh toán</span>
              <strong>{money(order.totalAmount)}</strong>
            </div>
          </article>
        );
      })}
    </section>
  );
}
