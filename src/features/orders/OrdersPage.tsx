import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import type { CurrentUser } from '../auth/types'
import type { OrderStatus, PaymentStatus } from '../checkout/api'
import { getCustomerOrders } from './api'

const currencyFormatter = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  maximumFractionDigits: 2,
})

const dateFormatter = new Intl.DateTimeFormat('tr-TR', {
  dateStyle: 'long',
  timeStyle: 'short',
})

const orderLabels: Record<OrderStatus, string> = {
  pending: 'Bekliyor',
  processing: 'İşleniyor',
  confirmed: 'Onaylandı',
  failed: 'Başarısız',
  cancelled: 'İptal edildi',
}

const paymentLabels: Record<PaymentStatus, string> = {
  pending: 'Bekliyor',
  processing: 'İşleniyor',
  completed: 'Ödendi',
  failed: 'Reddedildi',
  refunded: 'İade edildi',
}

interface OrdersPageProps {
  user: CurrentUser | null
  onRequireAuth: () => void
}

export function OrdersPage({ user, onRequireAuth }: OrdersPageProps) {
  const [page, setPage] = useState(1)
  const customerId = user?.customer_id ?? null
  const ordersQuery = useQuery({
    queryKey: ['orders', customerId, page],
    queryFn: () => getCustomerOrders(customerId!, page),
    enabled: Boolean(customerId),
    refetchInterval: (query) => query.state.data?.data.some((order) =>
      order.status === 'processing'
      || order.payment_status === 'pending'
      || order.payment_status === 'processing') ? 5_000 : false,
  })

  if (!user) {
    return (
      <main className="orders-page orders-gate">
        <p className="section-number">Sipariş geçmişi</p>
        <h1>Siparişlerini görmek için giriş yap.</h1>
        <button type="button" onClick={onRequireAuth}>Giriş yap veya kayıt ol</button>
      </main>
    )
  }

  if (!customerId) {
    return (
      <main className="orders-page orders-gate">
        <p className="section-number">Sipariş geçmişi</p>
        <h1>Müşteri hesabı gerekli.</h1>
        <p>Yönetici hesaplarının müşteri sipariş geçmişi bulunmaz.</p>
      </main>
    )
  }

  return (
    <main className="orders-page">
      <div className="orders-heading">
        <div>
          <p className="section-number">Hesabım / Siparişler</p>
          <h1>Siparişlerim.</h1>
        </div>
        <Link to="/#products">Alışverişe dön →</Link>
      </div>

      {ordersQuery.isPending && <div className="orders-state">Siparişlerin yükleniyor…</div>}
      {ordersQuery.isError && (
        <div className="orders-state" role="alert">
          <h2>Siparişler alınamadı.</h2>
          <button type="button" onClick={() => ordersQuery.refetch()}>Tekrar dene</button>
        </div>
      )}
      {ordersQuery.data?.data.length === 0 && (
        <div className="orders-state">
          <h2>Henüz siparişin yok.</h2>
          <Link to="/#products">Ürünleri keşfet →</Link>
        </div>
      )}
      {ordersQuery.data && ordersQuery.data.data.length > 0 && (
        <>
          <section className="orders-list" aria-label="Siparişlerim">
            {ordersQuery.data.data.map((order) => (
              <article className="order-card" key={order.id}>
                <div className="order-card-main">
                  <span>{dateFormatter.format(new Date(order.created_at))}</span>
                  <h2>{order.order_no}</h2>
                </div>
                <div><span>Tutar</span><strong>{currencyFormatter.format(order.total_amount)}</strong></div>
                <div>
                  <span>Ödeme</span>
                  <strong className={`status status-${order.payment_status ?? 'pending'}`}>
                    {order.payment_status ? paymentLabels[order.payment_status] : 'Başlatılmadı'}
                  </strong>
                </div>
                <div>
                  <span>Sipariş</span>
                  <strong className={`status status-${order.status}`}>{orderLabels[order.status]}</strong>
                </div>
              </article>
            ))}
          </section>
          {ordersQuery.data.total_pages > 1 && (
            <div className="pagination" aria-label="Sipariş sayfalama">
              <button type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>← Önceki</button>
              <span>{page} / {ordersQuery.data.total_pages}</span>
              <button type="button" disabled={page === ordersQuery.data.total_pages} onClick={() => setPage((value) => value + 1)}>Sonraki →</button>
            </div>
          )}
        </>
      )}
    </main>
  )
}
