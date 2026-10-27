import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { z } from 'zod'
import type { CurrentUser } from '../auth/types'
import { clearCart } from '../cart/api'
import type { CartItem } from '../cart/store'
import {
  createAddress,
  createOrder,
  getAddresses,
  getCheckoutStatus,
  startPayment,
} from './api'
import type { PaymentMethod } from './api'

const currencyFormatter = new Intl.NumberFormat('tr-TR', {
  style: 'currency',
  currency: 'TRY',
  maximumFractionDigits: 2,
})

const addressSchema = z.object({
  title: z.string().min(2, 'Adres başlığı en az 2 karakter olmalı.'),
  city: z.string().min(2, 'Şehir yazmalısın.'),
  district: z.string().min(2, 'İlçe yazmalısın.'),
  address_line: z.string().min(8, 'Açık adres en az 8 karakter olmalı.'),
  postal_code: z.string(),
})

type AddressForm = z.infer<typeof addressSchema>

interface CheckoutPageProps {
  items: CartItem[]
  user: CurrentUser | null
  onRequireAuth: () => void
  onCompleted: () => void
}

function errorMessage(error: unknown) {
  if (!axios.isAxiosError(error)) return 'Beklenmeyen bir hata oluştu.'
  return error.response?.data?.error?.message ?? 'İşlem tamamlanamadı. Lütfen tekrar dene.'
}

export function CheckoutPage({ items, user, onRequireAuth, onCompleted }: CheckoutPageProps) {
  const queryClient = useQueryClient()
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('credit_card')
  const [paymentToken, setPaymentToken] = useState('tok_success')
  const subtotal = items.reduce((total, item) => total + item.product.price * item.quantity, 0)
  const customerId = user?.customer_id ?? null

  const addressesQuery = useQuery({
    queryKey: ['addresses', customerId],
    queryFn: () => getAddresses(customerId!),
    enabled: Boolean(customerId),
  })
  const shippingAddresses = addressesQuery.data?.filter((address) => address.address_type === 'shipping') ?? []
  const effectiveAddressId = selectedAddressId ?? shippingAddresses[0]?.id ?? null

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AddressForm>({
    resolver: zodResolver(addressSchema),
    defaultValues: { title: '', city: '', district: '', address_line: '', postal_code: '' },
  })

  const addressMutation = useMutation({
    mutationFn: (values: AddressForm) => createAddress(customerId!, {
      ...values,
      postal_code: values.postal_code || undefined,
      address_type: 'shipping',
    }),
    onSuccess: (address) => {
      queryClient.setQueryData(['addresses', customerId], (current: typeof shippingAddresses | undefined) =>
        [...(current ?? []), address])
      setSelectedAddressId(address.id)
      reset()
    },
  })

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      if (!customerId || effectiveAddressId === null) throw new Error('ADDRESS_REQUIRED')
      const order = await createOrder({
        customer_id: customerId,
        shipping_address_id: effectiveAddressId,
        items: items.map((item) => ({ product_id: item.product.id, quantity: item.quantity })),
      })
      const payment = await startPayment(
        order.id,
        paymentMethod,
        paymentMethod === 'credit_card' ? paymentToken : undefined,
      )
      try {
        await clearCart()
      } catch {
        // The accepted order must not be reported as failed just because cart cleanup failed.
      }
      return { order, payment }
    },
    onSuccess: onCompleted,
  })

  const checkoutStatusQuery = useQuery({
    queryKey: ['checkout-status', checkoutMutation.data?.order.id, checkoutMutation.data?.payment.id],
    queryFn: () => getCheckoutStatus(
      checkoutMutation.data!.order.id,
      checkoutMutation.data!.payment.id,
    ),
    enabled: Boolean(checkoutMutation.data),
    refetchInterval: (query) => {
      const status = query.state.data
      return status?.paymentStatus === 'completed'
        || status?.paymentStatus === 'failed'
        || status?.paymentStatus === 'refunded'
        || status?.orderStatus === 'cancelled'
        ? false
        : 2_000
    },
  })

  if (!user) {
    return (
      <main className="checkout-page checkout-gate">
        <p className="section-number">Güvenli ödeme</p>
        <h1>Devam etmek için giriş yap.</h1>
        <p>Adresini ve siparişini hesabınla güvenli şekilde eşleştirmemiz gerekiyor.</p>
        <button type="button" onClick={onRequireAuth}>Giriş yap veya kayıt ol</button>
        <Link to="/cart">← Sepete dön</Link>
      </main>
    )
  }

  if (!customerId) {
    return (
      <main className="checkout-page checkout-gate">
        <p className="section-number">Güvenli ödeme</p>
        <h1>Müşteri hesabı gerekli.</h1>
        <p>Yönetici hesapları sipariş veremez. Ödemeye devam etmek için müşteri hesabıyla giriş yap.</p>
        <Link to="/cart">← Sepete dön</Link>
      </main>
    )
  }

  if (checkoutMutation.data) {
    const { order, payment } = checkoutMutation.data
    const orderStatus = checkoutStatusQuery.data?.orderStatus ?? order.status
    const paymentStatus = checkoutStatusQuery.data?.paymentStatus ?? payment.status
    const rejected = paymentStatus === 'failed' || orderStatus === 'failed' || orderStatus === 'cancelled'
    const completed = paymentStatus === 'completed' || orderStatus === 'confirmed'
    const resultState = rejected ? 'failed' : completed ? 'success' : 'pending'
    return (
      <main className={`checkout-page checkout-result checkout-result-${resultState}`}>
        <span className={`result-mark ${resultState}`} aria-hidden="true">
          {rejected ? '×' : completed ? '✓' : '…'}
        </span>
        <p className="section-number">
          {rejected ? 'Ödeme reddedildi' : completed ? 'Ödeme tamamlandı' : 'Ödeme işleniyor'}
        </p>
        <h1>{rejected ? 'Ödeme alınamadı.' : completed ? 'Teşekkürler.' : 'Sonuç bekleniyor.'}</h1>
        <p>
          {rejected
            ? checkoutStatusQuery.data?.failureReason ?? 'Siparişin oluşturuldu ancak ödeme sağlayıcı işlemi reddetti.'
            : completed
              ? 'Ödemen onaylandı ve siparişin hazırlanmaya alındı.'
              : 'Siparişin oluşturuldu. Ödeme sağlayıcısından gelecek sonucu bekliyoruz.'}
        </p>
        <dl>
          <div><dt>Sipariş no</dt><dd>{order.order_no}</dd></div>
          <div><dt>Tutar</dt><dd>{currencyFormatter.format(order.total_amount)}</dd></div>
          <div><dt>Ödeme</dt><dd>{paymentStatus}</dd></div>
          <div><dt>Sipariş durumu</dt><dd>{orderStatus}</dd></div>
        </dl>
        <div className="checkout-result-actions">
          <Link to="/orders">Siparişlerime git →</Link>
          <Link to="/">Alışverişe dön</Link>
        </div>
      </main>
    )
  }

  if (items.length === 0) {
    return (
      <main className="checkout-page checkout-gate">
        <p className="section-number">Güvenli ödeme</p>
        <h1>Sepetin boş.</h1>
        <Link to="/#products">Ürünleri keşfet →</Link>
      </main>
    )
  }

  return (
    <main className="checkout-page">
      <div className="checkout-heading">
        <div><p className="section-number">Güvenli ödeme</p><h1>Siparişi tamamla.</h1></div>
        <Link to="/cart">← Sepete dön</Link>
      </div>

      <div className="checkout-layout">
        <div className="checkout-steps">
          <section className="checkout-section">
            <div className="checkout-section-title"><span>01</span><div><h2>Teslimat adresi</h2><p>Siparişinin gönderileceği adresi seç.</p></div></div>
            {addressesQuery.isPending ? <p>Adreslerin yükleniyor…</p> : (
              <div className="address-grid">
                {shippingAddresses.map((address) => (
                  <label className={effectiveAddressId === address.id ? 'address-card selected' : 'address-card'} key={address.id}>
                    <input
                      type="radio"
                      name="shipping-address"
                      checked={effectiveAddressId === address.id}
                      onChange={() => setSelectedAddressId(address.id)}
                    />
                    <strong>{address.title}</strong>
                    <span>{address.address_line}</span>
                    <span>{address.district} / {address.city} {address.postal_code}</span>
                  </label>
                ))}
              </div>
            )}

            <details className="new-address" open={shippingAddresses.length === 0}>
              <summary>+ Yeni teslimat adresi ekle</summary>
              <form onSubmit={handleSubmit((values) => addressMutation.mutate(values))}>
                <label><span>Adres başlığı</span><input placeholder="Ev" {...register('title')} />{errors.title && <small>{errors.title.message}</small>}</label>
                <label><span>Şehir</span><input placeholder="İstanbul" {...register('city')} />{errors.city && <small>{errors.city.message}</small>}</label>
                <label><span>İlçe</span><input placeholder="Kadıköy" {...register('district')} />{errors.district && <small>{errors.district.message}</small>}</label>
                <label className="wide"><span>Açık adres</span><textarea placeholder="Mahalle, sokak, bina ve daire" {...register('address_line')} />{errors.address_line && <small>{errors.address_line.message}</small>}</label>
                <label><span>Posta kodu</span><input placeholder="34710" {...register('postal_code')} /></label>
                <button type="submit" disabled={addressMutation.isPending}>Adresi kaydet</button>
                {addressMutation.isError && <p className="checkout-error">{errorMessage(addressMutation.error)}</p>}
              </form>
            </details>
          </section>

          <section className="checkout-section">
            <div className="checkout-section-title"><span>02</span><div><h2>Ödeme yöntemi</h2><p>Dummy ödeme servisiyle güvenli test akışı.</p></div></div>
            <div className="payment-methods">
              {([
                ['credit_card', 'Kredi kartı', 'Test kart tokenı ile'],
                ['bank_transfer', 'Banka havalesi', 'Sağlayıcı üzerinden'],
                ['cash_on_delivery', 'Kapıda ödeme', 'Teslimat sırasında'],
              ] as const).map(([value, title, copy]) => (
                <label className={paymentMethod === value ? 'payment-card selected' : 'payment-card'} key={value}>
                  <input type="radio" name="payment-method" checked={paymentMethod === value} onChange={() => setPaymentMethod(value)} />
                  <span><strong>{title}</strong><small>{copy}</small></span>
                </label>
              ))}
            </div>
            {paymentMethod === 'credit_card' && (
              <label className="payment-token">
                <span>Test ödeme tokenı</span>
                <input
                  list="payment-test-tokens"
                  value={paymentToken}
                  onChange={(event) => setPaymentToken(event.target.value)}
                />
                <datalist id="payment-test-tokens">
                  <option value="tok_success">Onaylanır</option>
                  <option value="tok_declined">Reddedilir</option>
                  <option value="tok_timeout">Callback gelmez</option>
                </datalist>
                <small>tok_success: başarılı · tok_declined: reddedilir · tok_timeout: callback gelmez</small>
              </label>
            )}
          </section>
        </div>

        <aside className="checkout-summary">
          <p className="section-number">Sipariş özeti</p>
          <div className="checkout-products">
            {items.map((item) => (
              <div key={item.product.id}><span>{item.product.name} × {item.quantity}</span><strong>{currencyFormatter.format(item.product.price * item.quantity)}</strong></div>
            ))}
          </div>
          <div className="checkout-total"><span>Toplam</span><strong>{currencyFormatter.format(subtotal)}</strong></div>
          {checkoutMutation.isError && (
            <p className="checkout-error" role="alert">
              {checkoutMutation.error instanceof Error && checkoutMutation.error.message === 'ADDRESS_REQUIRED'
                ? 'Devam etmek için bir teslimat adresi seç.'
                : errorMessage(checkoutMutation.error)}
            </p>
          )}
          <button
            type="button"
            disabled={checkoutMutation.isPending || effectiveAddressId === null || (paymentMethod === 'credit_card' && !paymentToken)}
            onClick={() => checkoutMutation.mutate()}
          >
            {checkoutMutation.isPending ? 'İşleniyor…' : 'Siparişi ve ödemeyi tamamla'}
          </button>
          <p>Bu ortamda gerçek kart bilgisi kullanılmaz.</p>
        </aside>
      </div>
    </main>
  )
}
