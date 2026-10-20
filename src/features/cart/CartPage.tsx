import { Link } from 'react-router-dom'
import type { CartItem } from './store'

const currencyFormatter = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  maximumFractionDigits: 2,
})

interface CartPageProps {
  items: CartItem[]
  loading?: boolean
  error?: string | null
  authenticated: boolean
  onSetQuantity: (productId: number, quantity: number) => void
  onRemove: (productId: number) => void
  onClear: () => void
  onCheckout: () => void
}

export function CartPage({
  items,
  loading = false,
  error,
  authenticated,
  onSetQuantity,
  onRemove,
  onClear,
  onCheckout,
}: CartPageProps) {
  const itemCount = items.reduce((total, item) => total + item.quantity, 0)
  const subtotal = items.reduce((total, item) => total + item.product.price * item.quantity, 0)

  return (
    <main className="cart-page">
      <div className="cart-page-heading">
        <div>
          <p className="section-number">Sepet detayları</p>
          <h1>Sepetim.</h1>
        </div>
        <Link to="/#products">← Alışverişe devam et</Link>
      </div>

      {loading ? (
        <div className="cart-page-empty">Sepetin yükleniyor…</div>
      ) : items.length === 0 ? (
        <div className="cart-page-empty">
          <h2>Sepetin henüz boş.</h2>
          <p>Ürünleri inceleyip beğendiklerini sepetine ekleyebilirsin.</p>
          <Link to="/#products">Ürünleri keşfet</Link>
        </div>
      ) : (
        <div className="cart-page-layout">
          <section className="cart-detail-list" aria-label="Sepetteki ürünler">
            <div className="cart-detail-labels" aria-hidden="true">
              <span>Ürün</span><span>Fiyat</span><span>Adet</span><span>Toplam</span>
            </div>
            {items.map(({ product, quantity }) => (
              <article className="cart-detail-item" key={product.id}>
                <div className="cart-detail-product">
                  <div className="cart-detail-visual" aria-hidden="true">
                    {product.category_name.slice(0, 2).toLocaleUpperCase('tr-TR')}
                  </div>
                  <div>
                    <span>{product.category_name}</span>
                    <h2>{product.name}</h2>
                    <p>SKU: {product.sku} · Stok: {product.stock}</p>
                    <button type="button" onClick={() => onRemove(product.id)}>Ürünü çıkar</button>
                  </div>
                </div>
                <span className="cart-detail-price" data-label="Birim fiyat">
                  {currencyFormatter.format(product.price)}
                </span>
                <div className="quantity-control" aria-label={`${product.name} adedi`}>
                  <button type="button" onClick={() => onSetQuantity(product.id, quantity - 1)} aria-label="Adedi azalt">−</button>
                  <span>{quantity}</span>
                  <button
                    type="button"
                    onClick={() => onSetQuantity(product.id, quantity + 1)}
                    disabled={quantity >= product.stock}
                    aria-label="Adedi artır"
                  >+</button>
                </div>
                <strong className="cart-detail-total" data-label="Toplam">
                  {currencyFormatter.format(product.price * quantity)}
                </strong>
              </article>
            ))}
          </section>

          <aside className="order-summary">
            <p className="section-number">Sipariş özeti</p>
            {error && <p className="cart-error" role="alert">{error}</p>}
            <dl>
              <div><dt>Ürün adedi</dt><dd>{itemCount}</dd></div>
              <div><dt>Ara toplam</dt><dd>{currencyFormatter.format(subtotal)}</dd></div>
              <div><dt>Kargo</dt><dd>Sipariş adımında</dd></div>
            </dl>
            <div className="order-summary-total">
              <span>Toplam</span><strong>{currencyFormatter.format(subtotal)}</strong>
            </div>
            <p className="cart-account-note">
              {authenticated
                ? 'Bu sepet hesabına kaydedildi ve diğer oturumlarında da korunur.'
                : 'Giriş yaptığında bu sepet otomatik olarak hesabına aktarılır.'}
            </p>
            <button className="checkout-button" type="button" onClick={onCheckout}>Ödemeye geç →</button>
            <button className="cart-clear" type="button" onClick={onClear}>Sepeti temizle</button>
          </aside>
        </div>
      )}
    </main>
  )
}
