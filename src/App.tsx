import { useDeferredValue, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AuthDialog } from './features/auth/AuthDialog'
import { getCurrentUser, logout } from './features/auth/api'
import { useAuthStore } from './features/auth/store'
import { CartDrawer } from './features/cart/CartDrawer'
import { CartPage } from './features/cart/CartPage'
import { CheckoutPage } from './features/checkout/CheckoutPage'
import { OrdersPage } from './features/orders/OrdersPage'
import {
  addCartItem as addServerCartItem,
  clearCart as clearServerCart,
  getCart,
  removeCartItem as removeServerCartItem,
  updateCartItem as updateServerCartItem,
} from './features/cart/api'
import { useCartStore } from './features/cart/store'
import type { CartItem } from './features/cart/store'
import { getProducts } from './features/products/api'
import type { Product } from './features/products/types'
import './App.css'

const currencyFormatter = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  maximumFractionDigits: 2,
})

const categoryColors = [
  'linear-gradient(135deg, #f0e7f8 0%, #d8c0ec 100%)',
  'linear-gradient(135deg, #f5e9dc 0%, #e3c7a7 100%)',
  'linear-gradient(135deg, #e8edf5 0%, #bdcbe0 100%)',
  'linear-gradient(135deg, #f1e7ef 0%, #d9bfd4 100%)',
]

interface ProductCardProps {
  product: Product
  cartQuantity: number
  onAdd: (product: Product) => void
}

function ProductCard({ product, cartQuantity, onAdd }: ProductCardProps) {
  return (
    <article className="product-card">
      <div
        className="product-visual"
        style={{ background: categoryColors[product.category_id % categoryColors.length] }}
        aria-hidden="true"
      >
        <span>{product.category_name.slice(0, 2).toLocaleUpperCase('tr-TR')}</span>
      </div>
      <div className="product-content">
        <div className="product-meta">
          <span>{product.category_name}</span>
          <span>{product.stock > 0 ? `${product.stock} adet` : 'Tükendi'}</span>
        </div>
        <h3>{product.name}</h3>
        <p className="sku">{product.sku}</p>
        <div className="product-footer">
          <strong>{currencyFormatter.format(product.price)}</strong>
          <span className={product.stock > 0 ? 'stock available' : 'stock unavailable'}>
            {product.stock > 0 ? 'Stokta' : 'Stok yok'}
          </span>
        </div>
        <div className="product-actions">
          <button
            className="add-to-cart"
            type="button"
            disabled={product.stock === 0 || cartQuantity >= product.stock}
            onClick={() => onAdd(product)}
          >
            {product.stock === 0
              ? 'Stokta yok'
              : cartQuantity >= product.stock
                ? 'Stok sınırına ulaştın'
                : cartQuantity > 0 ? `Bir tane daha ekle · ${cartQuantity}` : 'Sepete ekle'}
          </button>
        </div>
      </div>
    </article>
  )
}

function App() {
  const queryClient = useQueryClient()
  const location = useLocation()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('created_at,desc')
  const [page, setPage] = useState(1)
  const [authOpen, setAuthOpen] = useState(false)
  const [cartOpen, setCartOpen] = useState(false)
  const [cartError, setCartError] = useState<string | null>(null)
  const mergedCartForUser = useRef<number | null>(null)
  const deferredSearch = useDeferredValue(search.trim())
  const accessToken = useAuthStore((state) => state.accessToken)
  const refreshToken = useAuthStore((state) => state.refreshToken)
  const user = useAuthStore((state) => state.user)
  const setUser = useAuthStore((state) => state.setUser)
  const clearSession = useAuthStore((state) => state.clearSession)
  const cartItems = useCartStore((state) => state.items)
  const addCartItem = useCartStore((state) => state.addItem)
  const setLocalCartQuantity = useCartStore((state) => state.setQuantity)
  const removeLocalCartItem = useCartStore((state) => state.removeItem)
  const clearLocalCart = useCartStore((state) => state.clearCart)

  const serverCartQuery = useQuery({
    queryKey: ['cart', user?.user_id],
    queryFn: getCart,
    enabled: Boolean(accessToken && user),
    retry: false,
  })

  const serverCartItems: CartItem[] = serverCartQuery.data?.items.map((item) => ({
    product: {
      id: item.product_id,
      category_id: item.category_id,
      category_name: item.category_name,
      name: item.name,
      sku: item.sku,
      price: item.unit_price,
      stock: item.available_stock,
    },
    quantity: item.quantity,
  })) ?? []
  const displayedCartItems = accessToken ? serverCartItems : cartItems
  const cartItemCount = displayedCartItems.reduce((total, item) => total + item.quantity, 0)

  const updateServerCart = (cart: Awaited<ReturnType<typeof getCart>>) => {
    queryClient.setQueryData(['cart', user?.user_id], cart)
    setCartError(null)
  }

  const addCartMutation = useMutation({
    mutationFn: (productId: number) => addServerCartItem(productId),
    onSuccess: updateServerCart,
    onError: () => setCartError('Ürün sepete eklenemedi. Stok bilgisini kontrol et.'),
  })
  const updateCartMutation = useMutation({
    mutationFn: ({ productId, quantity }: { productId: number; quantity: number }) =>
      updateServerCartItem(productId, quantity),
    onSuccess: updateServerCart,
    onError: () => setCartError('Sepet adedi güncellenemedi.'),
  })
  const removeCartMutation = useMutation({
    mutationFn: removeServerCartItem,
    onSuccess: updateServerCart,
    onError: () => setCartError('Ürün sepetten çıkarılamadı.'),
  })
  const clearCartMutation = useMutation({
    mutationFn: clearServerCart,
    onSuccess: () => {
      queryClient.setQueryData(['cart', user?.user_id], (current: Awaited<ReturnType<typeof getCart>> | undefined) =>
        current ? { ...current, items: [], total_items: 0, subtotal: 0 } : current)
      setCartError(null)
    },
    onError: () => setCartError('Sepet temizlenemedi.'),
  })

  const currentUserQuery = useQuery({
    queryKey: ['current-user'],
    queryFn: getCurrentUser,
    enabled: Boolean(accessToken),
    retry: false,
  })

  useEffect(() => {
    if (currentUserQuery.data) setUser(currentUserQuery.data)
  }, [currentUserQuery.data, setUser])

  useEffect(() => {
    if (!accessToken || !user || !serverCartQuery.isSuccess || cartItems.length === 0
        || mergedCartForUser.current === user.user_id) return

    mergedCartForUser.current = user.user_id
    const mergeGuestCart = async () => {
      try {
        let mergedCart = serverCartQuery.data
        for (const item of cartItems) {
          mergedCart = await addServerCartItem(item.product.id, item.quantity)
        }
        queryClient.setQueryData(['cart', user.user_id], mergedCart)
        clearLocalCart()
      } catch {
        mergedCartForUser.current = null
        setCartError('Misafir sepetin hesabına aktarılamadı.')
      }
    }
    void mergeGuestCart()
  }, [accessToken, cartItems, clearLocalCart, queryClient, serverCartQuery.data,
    serverCartQuery.isSuccess, user])

  const logoutMutation = useMutation({
    mutationFn: async () => {
      if (refreshToken) await logout(refreshToken)
    },
    onSettled: () => {
      clearSession()
      queryClient.removeQueries({ queryKey: ['current-user'] })
      queryClient.removeQueries({ queryKey: ['cart'] })
      mergedCartForUser.current = null
    },
  })

  const productsQuery = useQuery({
    queryKey: ['products', page, deferredSearch, sort],
    queryFn: () => getProducts({ page, search: deferredSearch, sort }),
  })

  const handleSearch = (value: string) => {
    setSearch(value)
    setPage(1)
  }

  const handleSort = (value: string) => {
    setSort(value)
    setPage(1)
  }

  const handleAddToCart = (product: Product) => {
    setCartOpen(true)
    if (accessToken) addCartMutation.mutate(product.id)
    else addCartItem(product)
  }

  const handleCartQuantity = (productId: number, quantity: number) => {
    if (accessToken) {
      if (quantity <= 0) removeCartMutation.mutate(productId)
      else updateCartMutation.mutate({ productId, quantity })
    } else setLocalCartQuantity(productId, quantity)
  }

  const handleRemoveCartItem = (productId: number) => {
    if (accessToken) removeCartMutation.mutate(productId)
    else removeLocalCartItem(productId)
  }

  const handleClearCart = () => {
    if (accessToken) clearCartMutation.mutate()
    else clearLocalCart()
  }

  const handleCheckout = () => {
    if (!accessToken) {
      setAuthOpen(true)
      return
    }
    navigate('/checkout')
  }

  const handleCheckoutCompleted = () => {
    queryClient.setQueryData(['cart', user?.user_id], (current: Awaited<ReturnType<typeof getCart>> | undefined) =>
      current ? { ...current, items: [], total_items: 0, subtotal: 0 } : current)
    void queryClient.invalidateQueries({ queryKey: ['orders', user?.customer_id] })
    clearLocalCart()
  }

  const errorMessage = axios.isAxiosError(productsQuery.error)
    ? productsQuery.error.response?.data?.error?.message ?? 'Ürünler alınamadı.'
    : 'Beklenmeyen bir hata oluştu.'

  return (
    <div className="app-shell">
      <header className="site-header">
        <Link className="brand" to="/" aria-label="Dükkan ana sayfa">
          dükkan<span>.</span>
        </Link>
        <nav aria-label="Ana menü">
          <a href="/#products">Ürünler</a>
          <a href="/#about">Hakkımızda</a>
          {accessToken && user?.customer_id && <Link to="/orders">Siparişlerim</Link>}
        </nav>
        <div className="header-actions">
          {accessToken ? (
            <div className="account-area">
              {user?.customer_id && <Link className="account-orders-link" to="/orders">Siparişlerim</Link>}
              <span title={user?.email}>{user?.name ?? user?.email ?? 'Hesabım'}</span>
              <button type="button" onClick={() => logoutMutation.mutate()} disabled={logoutMutation.isPending}>
                Çıkış yap
              </button>
            </div>
          ) : (
            <button className="account-button" type="button" onClick={() => setAuthOpen(true)}>
              Giriş yap
            </button>
          )}
          <button className="cart-button" type="button" onClick={() => setCartOpen(true)} aria-label={`Sepeti aç, ${cartItemCount} ürün`}>
            Sepet <span>{cartItemCount}</span>
          </button>
        </div>
      </header>

      {location.pathname === '/orders' ? (
        <OrdersPage user={user} onRequireAuth={() => setAuthOpen(true)} />
      ) : location.pathname === '/checkout' ? (
        <CheckoutPage
          items={displayedCartItems}
          user={user}
          onRequireAuth={() => setAuthOpen(true)}
          onCompleted={handleCheckoutCompleted}
        />
      ) : location.pathname === '/cart' ? (
        <CartPage
          items={displayedCartItems}
          loading={Boolean(accessToken) && serverCartQuery.isPending}
          error={cartError}
          authenticated={Boolean(accessToken)}
          onSetQuantity={handleCartQuantity}
          onRemove={handleRemoveCartItem}
          onClear={handleClearCart}
          onCheckout={handleCheckout}
        />
      ) : (
      <main id="top">
        <section className="hero-section" aria-labelledby="hero-title">
          <p className="eyebrow">Seçili ürünler · sade alışveriş</p>
          <h1 id="hero-title">İhtiyacın olanı,<br />kolayca bul.</h1>
          <p className="hero-copy">
            Günlük hayat için özenle seçilmiş ürünleri keşfet. Fiyatı, stoğu ve
            kategoriyi tek bakışta gör.
          </p>
          <a className="hero-link" href="#products">
            Koleksiyonu keşfet <span aria-hidden="true">↓</span>
          </a>
        </section>

        <section className="catalog-section" id="products" aria-labelledby="catalog-title">
          <div className="catalog-heading">
            <div>
              <p className="section-number">01 / Katalog</p>
              <h2 id="catalog-title">Tüm ürünler</h2>
            </div>
            {productsQuery.data && (
              <p className="result-count">{productsQuery.data.total_elements} ürün</p>
            )}
          </div>

          <div className="catalog-controls">
            <label className="search-field">
              <span className="sr-only">Ürün ara</span>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m21 21-4.35-4.35m2.35-5.65a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z" />
              </svg>
              <input
                type="search"
                value={search}
                onChange={(event) => handleSearch(event.target.value)}
                placeholder="Ürün veya SKU ara"
              />
            </label>
            <label className="sort-field">
              <span>Sırala</span>
              <select value={sort} onChange={(event) => handleSort(event.target.value)}>
                <option value="created_at,desc">En yeniler</option>
                <option value="price,asc">Fiyat: artan</option>
                <option value="price,desc">Fiyat: azalan</option>
                <option value="name,asc">İsim: A–Z</option>
              </select>
            </label>
          </div>

          {productsQuery.isPending && (
            <div className="product-grid" aria-label="Ürünler yükleniyor">
              {Array.from({ length: 8 }, (_, index) => (
                <div className="product-card skeleton-card" key={index} aria-hidden="true">
                  <div className="skeleton visual-skeleton" />
                  <div className="skeleton-lines">
                    <div className="skeleton short" />
                    <div className="skeleton" />
                    <div className="skeleton medium" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {productsQuery.isError && (
            <div className="state-panel" role="alert">
              <span>Bağlantı kurulamadı</span>
              <h3>{errorMessage}</h3>
              <p>Backend servisinin çalıştığından emin olup yeniden deneyebilirsin.</p>
              <button type="button" onClick={() => productsQuery.refetch()}>Tekrar dene</button>
            </div>
          )}

          {productsQuery.data?.data.length === 0 && (
            <div className="state-panel">
              <span>Sonuç bulunamadı</span>
              <h3>Aramana uygun ürün yok.</h3>
              <button type="button" onClick={() => handleSearch('')}>Aramayı temizle</button>
            </div>
          )}

          {productsQuery.data && productsQuery.data.data.length > 0 && (
            <>
              <div className="product-grid">
                {productsQuery.data.data.map((product) => (
                  <ProductCard
                    product={product}
                    cartQuantity={displayedCartItems.find((item) => item.product.id === product.id)?.quantity ?? 0}
                    onAdd={handleAddToCart}
                    key={product.id}
                  />
                ))}
              </div>
              {productsQuery.data.total_pages > 1 && (
                <div className="pagination" aria-label="Sayfalama">
                  <button
                    type="button"
                    disabled={page === 1}
                    onClick={() => setPage((current) => current - 1)}
                  >
                    ← Önceki
                  </button>
                  <span>{page} / {productsQuery.data.total_pages}</span>
                  <button
                    type="button"
                    disabled={page === productsQuery.data.total_pages}
                    onClick={() => setPage((current) => current + 1)}
                  >
                    Sonraki →
                  </button>
                </div>
              )}
            </>
          )}
        </section>

        <section className="about-section" id="about">
          <p className="section-number">02 / Yaklaşımımız</p>
          <p>Az ama iyi seçenek. Şeffaf stok bilgisi. Gereksiz adım olmadan alışveriş.</p>
        </section>
      </main>
      )}

      <footer>
        <Link className="brand footer-brand" to="/">dükkan<span>.</span></Link>
        <p>© 2026 · İstanbul</p>
      </footer>
      <AuthDialog open={authOpen} onClose={() => setAuthOpen(false)} />
      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        items={displayedCartItems}
        loading={Boolean(accessToken) && serverCartQuery.isPending}
        error={cartError}
        onSetQuantity={handleCartQuantity}
        onRemove={handleRemoveCartItem}
        onClear={handleClearCart}
        onViewCart={() => {
          setCartOpen(false)
          navigate('/cart')
        }}
      />
    </div>
  )
}

export default App
