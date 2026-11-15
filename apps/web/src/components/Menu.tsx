'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api, money, type Category, type Product } from '../lib/api';

export function Menu() {
  const [items, setItems] = useState<Product[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setBusy(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (q.trim()) {
        params.set('q', q.trim());
      }
      if (category) {
        params.set('categoryId', category);
      }
      const data = await api<{ items: Product[]; total: number }>(
        `/products?${params.toString()}`,
      );
      setItems(data.items);
      setTotal(data.total);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }, [page, q, category]);

  useEffect(() => {
    const timer = setTimeout(() => {
      void load();
    }, 150);
    return () => clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    void api<Category[]>('/categories')
      .then((data) => setCategories(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  return (
    <>
      <section className="hero">
        <div>
          <p className="intro">Quán quen, ngay trong tay bạn</p>
          <h1>
            Hôm nay,
            <br />
            uống gì nhé?
          </h1>
          <p>
            Chọn ly bạn thích. Thêm chút topping.
            <br />
            Chúng mình pha mới ngay khi bạn đặt.
          </p>
          <a className="button" href="#menu">
            Chọn món
          </a>
        </div>
        <div className="cup-scene" aria-hidden="true">
          <div className="cup">
            <span>BrewLite</span>
          </div>
          <div className="saucer" />
        </div>
      </section>

      <section id="menu">
        <div className="section-title">
          <h2>Thực đơn hôm nay</h2>
          <span>{total} món</span>
        </div>

        <div className="filters">
          <label className="search">
            Tìm món
            <input
              value={q}
              placeholder="Cà phê, trà…"
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
          </label>

          <label>
            Danh mục
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Tất cả</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {busy ? (
          <div role="status" className="notice">
            Đang pha một chút… Đang tải thực đơn.
          </div>
        ) : error ? (
          <div role="alert" className="notice error">
            {error}
            <button type="button" onClick={() => void load()}>
              Thử lại
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="notice">
            Chưa có món phù hợp. Hãy thử từ khóa khác.
          </div>
        ) : (
          <div className="menu-grid">
            {items.map((product, index) => (
              <article className="product" key={product.id}>
                <div
                  className={`product-art art-${index % 4}`}
                  aria-hidden={!product.imageUrl}
                >
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                    />
                  ) : (
                    <div className="mini-cup" />
                  )}
                </div>
                <div className="product-info">
                  <span>{product.category?.name}</span>
                  <h3>{product.name}</h3>
                  <p>
                    {product.stockQuantity > 0
                      ? 'Pha mới theo lựa chọn'
                      : 'Hết hàng'}
                  </p>
                  <div className="product-bottom">
                    <strong>{money(product.basePrice)}</strong>
                    {product.stockQuantity > 0 ? (
                      <Link className="button" href={`/products/${product.id}`}>
                        Chọn món
                      </Link>
                    ) : (
                      <button type="button" className="button" disabled>
                        Hết hàng
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        <div className="pager">
          <button
            type="button"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            Trang trước
          </button>
          <span>Trang {page}</span>
          <button
            type="button"
            disabled={page * 20 >= total}
            onClick={() => setPage(page + 1)}
          >
            Trang sau
          </button>
        </div>
      </section>
    </>
  );
}
