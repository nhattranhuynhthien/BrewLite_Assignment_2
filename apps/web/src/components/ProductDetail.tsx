'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, money, type Product } from '../lib/api';
import { addLine, changeCart, lineKey } from '../lib/cart';

export function ProductDetail({ id }: { id: string }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [size, setSize] = useState('');
  const [toppings, setToppings] = useState<string[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    void api<Product>(`/products/${id}`)
      .then((data) => {
        if (active) {
          setProduct(data);
          setSize(data.sizes?.[0]?.id || '');
        }
      })
      .catch((err) => {
        if (active) {
          setError((err as Error).message);
        }
      });
    return () => {
      active = false;
    };
  }, [id]);

  if (!product) {
    return (
      <div className="panel">
        {error ? (
          <p role="alert">{error}</p>
        ) : (
          <p role="status">Đang tải món…</p>
        )}
        <Link href="/">Về thực đơn</Link>
      </div>
    );
  }

  const selectedSize = product.sizes?.find((s) => s.id === size);
  const selectedToppings =
    product.toppings?.filter((t) => toppings.includes(t.id)) || [];
  const unitPrice =
    product.basePrice +
    (selectedSize?.extraPrice || 0) +
    selectedToppings.reduce((sum, t) => sum + t.extraPrice, 0);

  const maxQuantity = Math.min(50, product.stockQuantity);
  const canAdd =
    !!selectedSize &&
    product.stockQuantity > 0 &&
    Number.isInteger(quantity) &&
    quantity >= 1 &&
    quantity <= maxQuantity;

  async function handleAdd() {
    if (!product || !selectedSize) {
      return;
    }
    try {
      await changeCart((lines) =>
        addLine(lines, {
          key: lineKey(product.id, size, toppings),
          productId: product.id,
          sizeId: size,
          toppingIds: toppings,
          name: product.name,
          imageUrl: product.imageUrl ?? null,
          sizeName: selectedSize.name,
          toppingNames: selectedToppings.map((t) => t.name),
          unitPrice,
          quantity,
          stock: product.stockQuantity,
        }),
      );
      setMessage('Đã thêm vào giỏ hàng.');
      setError('');
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <section className="panel">
      <Link href="/">‹ Thực đơn</Link>
      <h1 style={{ fontSize: 38 }}>{product.name}</h1>
      <p>{product.description}</p>
      <p className="muted">
        {product.stockQuantity > 0
          ? `Còn ${product.stockQuantity} ly`
          : 'Hết hàng'}
      </p>

      <h2>Chọn size</h2>
      <div className="choices">
        {product.sizes?.map((s) => (
          <label key={s.id}>
            <input
              type="radio"
              name="size"
              checked={size === s.id}
              onChange={() => setSize(s.id)}
            />
            {s.name} (+{money(s.extraPrice)})
          </label>
        ))}
      </div>

      <h2>Thêm topping</h2>
      <div className="choices">
        {product.toppings?.map((t) => (
          <label key={t.id}>
            <input
              type="checkbox"
              checked={toppings.includes(t.id)}
              onChange={() =>
                setToppings(
                  toppings.includes(t.id)
                    ? toppings.filter((x) => x !== t.id)
                    : [...toppings, t.id],
                )
              }
            />
            {t.name} (+{money(t.extraPrice)})
          </label>
        ))}
      </div>

      <label>
        Số lượng
        <input
          type="number"
          min={1}
          max={Math.max(1, maxQuantity)}
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
        />
      </label>

      <p className="price" data-testid="dynamic-price">
        {money(unitPrice * quantity)}
      </p>
      <p className="muted">Giá cuối cùng được kiểm tra lại khi đặt đơn.</p>

      {error && (
        <p role="alert" className="notice error">
          {error}
        </p>
      )}
      {message && (
        <p role="status">
          {message}{' '}
          <Link className="empty-link" href="/cart">
            Xem giỏ hàng
          </Link>
        </p>
      )}

      <button type="button" disabled={!canAdd} onClick={() => void handleAdd()}>
        Thêm vào giỏ
      </button>
    </section>
  );
}
