import { useEffect } from 'react'
import type { CartItem } from './store'

const currencyFormatter = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  maximumFractionDigits: 2,
})

interface CartDrawerProps {
  open: boolean
  onClose: () => void
  items: CartItem[]
  loading?: boolean
  error?: string | null
  onSetQuantity: (productId: number, quantity: number) => void
  onRemove: (productId: number) => void
  onClear: () => void
  onViewCart: () => void
}

export function CartDrawer({
  open,
  onClose,
  items,
  loading = false,
  error,
  onSetQuantity,
  onRemove,
  onClear,
  onViewCart,
}: CartDrawerProps) {
  const itemCount = items.reduce((total, item) => total + item.quantity, 0)
  const subtotal = items.reduce((total, item) => total + item.product.price * item.quantity, 0)

  useEffect(() => {
    if (!open) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="cart-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <aside className="cart-drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title">
        <div className="cart-header">
          <div>
            <p className="section-number">Sepetin</p>
            <h2 id="cart-title">{itemCount > 0 ? `${itemCount} ürün` : 'Henüz boş.'}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Sepeti kapat">×</button>
        </div>

        {loading ? (
          <div className="cart-empty"><p>Sepetin yükleniyor…</p></div>
        ) : items.length === 0 ? (
          <div className="cart-empty">
            <span aria-hidden="true">○</span>
            <p>Beğendiğin ürünleri eklediğinde burada görebilirsin.</p>
            <button type="button" onClick={onClose}>Ürünlere dön</button>
          </div>
        ) : (
          <>
            <div className="cart-items">
              {items.map(({ product, quantity }) => (
                <article className="cart-item" key={product.id}>
                  <div className="cart-item-visual" aria-hidden="true">
                    {product.category_name.slice(0, 2).toLocaleUpperCase('tr-TR')}
                  </div>
                  <div className="cart-item-content">
                    <div className="cart-item-title">
                      <div>
                        <span>{product.category_name}</span>
                        <h3>{product.name}</h3>
                      </div>
                      <button type="button" onClick={() => onRemove(product.id)} aria-label={`${product.name} ürününü sepetten çıkar`}>
                        ×
                      </button>
                    </div>
                    <div className="cart-item-bottom">
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
                      <strong>{currencyFormatter.format(product.price * quantity)}</strong>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <div className="cart-summary">
              {error && <p className="cart-error" role="alert">{error}</p>}
              <div><span>Ara toplam</span><strong>{currencyFormatter.format(subtotal)}</strong></div>
              <p>Kargo ve ödeme seçenekleri sipariş adımında hesaplanacak.</p>
              <button className="cart-view-button" type="button" onClick={onViewCart}>Sepete git →</button>
              <button className="cart-clear" type="button" onClick={onClear}>Sepeti temizle</button>
            </div>
          </>
        )}
      </aside>
    </div>
  )
}
