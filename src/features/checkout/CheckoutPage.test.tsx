import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
import type { Address, OrderResult, PaymentResult } from './api'
import { CheckoutPage } from './CheckoutPage'

vi.mock('../cart/api', () => ({
  clearCart: vi.fn(),
}))

vi.mock('./api', () => ({
  createAddress: vi.fn(),
  createOrder: vi.fn(),
  getAddresses: vi.fn(),
  getCheckoutStatus: vi.fn(),
  startPayment: vi.fn(),
}))

const clearCartMock = vi.mocked(clearCart)
const createAddressMock = vi.mocked(createAddress)
const createOrderMock = vi.mocked(createOrder)
const getAddressesMock = vi.mocked(getAddresses)
const getCheckoutStatusMock = vi.mocked(getCheckoutStatus)
const startPaymentMock = vi.mocked(startPayment)

const customer: CurrentUser = {
  user_id: 1,
  customer_id: 12,
  name: 'Test Kullanıcı',
  email: 'test@example.com',
  role: 'customer',
}

const items: CartItem[] = [{
  product: {
    id: 7,
    category_id: 2,
    category_name: 'Elektronik',
    name: 'Kablosuz Kulaklık',
    sku: 'KUL-007',
    price: 750,
    stock: 8,
  },
  quantity: 2,
}]

const shippingAddress: Address = {
  id: 21,
  customer_id: 12,
  address_type: 'shipping',
  title: 'Ev',
  city: 'İstanbul',
  district: 'Kadıköy',
  address_line: 'Test Mahallesi Test Sokak No 1',
  postal_code: '34710',
}

const order: OrderResult = {
  id: 31,
  order_no: 'ORD-2026-31',
  status: 'processing',
  total_amount: 1_500,
  currency: 'TRY',
}

const payment: PaymentResult = {
  id: 41,
  payment_no: 'PAY-2026-41',
  order_id: 31,
  method: 'credit_card',
  provider: 'dummy-payment-service',
  status: 'processing',
  amount: 1_500,
  transaction_id: 'provider-payment-41',
  failure_reason: null,
}

function renderCheckout({
  checkoutItems = items,
  currentUser = customer,
  onRequireAuth = vi.fn(),
  onCompleted = vi.fn(),
}: {
  checkoutItems?: CartItem[]
  currentUser?: CurrentUser | null
  onRequireAuth?: () => void
  onCompleted?: () => void
} = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  })

  return {
    onRequireAuth,
    onCompleted,
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/checkout']}>
          <CheckoutPage
            items={checkoutItems}
            user={currentUser}
            onRequireAuth={onRequireAuth}
            onCompleted={onCompleted}
          />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  }
}

describe('CheckoutPage', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    getAddressesMock.mockResolvedValue([shippingAddress])
    createOrderMock.mockResolvedValue(order)
    startPaymentMock.mockResolvedValue(payment)
    clearCartMock.mockResolvedValue(undefined)
    getCheckoutStatusMock.mockResolvedValue({
      orderStatus: 'processing',
      paymentStatus: 'processing',
      failureReason: null,
    })
  })

  it('asks unauthenticated users to sign in', async () => {
    const user = userEvent.setup()
    const onRequireAuth = vi.fn()

    renderCheckout({ currentUser: null, onRequireAuth })
    await user.click(screen.getByRole('button', { name: 'Giriş yap veya kayıt ol' }))

    expect(screen.getByRole('heading', { name: 'Devam etmek için giriş yap.' }))
      .toBeInTheDocument()
    expect(onRequireAuth).toHaveBeenCalledOnce()
    expect(getAddressesMock).not.toHaveBeenCalled()
  })

  it('prevents an admin account from checking out', () => {
    renderCheckout({
      currentUser: {
        user_id: 2,
        customer_id: null,
        name: 'Yönetici',
        email: 'admin@example.com',
        role: 'admin',
      },
    })

    expect(screen.getByRole('heading', { name: 'Müşteri hesabı gerekli.' }))
      .toBeInTheDocument()
    expect(screen.getByText(/Yönetici hesapları sipariş veremez/)).toBeInTheDocument()
    expect(getAddressesMock).not.toHaveBeenCalled()
  })

  it('shows an empty-cart state without starting checkout', async () => {
    renderCheckout({ checkoutItems: [] })

    expect(screen.getByRole('heading', { name: 'Sepetin boş.' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ürünleri keşfet →' }))
      .toHaveAttribute('href', '/#products')
    expect(createOrderMock).not.toHaveBeenCalled()
  })

  it('loads shipping addresses and renders the order total', async () => {
    getAddressesMock.mockResolvedValue([
      shippingAddress,
      { ...shippingAddress, id: 22, address_type: 'billing', title: 'Fatura' },
    ])

    renderCheckout()

    expect(await screen.findByText('Test Mahallesi Test Sokak No 1')).toBeInTheDocument()
    expect(screen.queryByText('Fatura')).not.toBeInTheDocument()
    expect(screen.getByText('Kablosuz Kulaklık × 2')).toBeInTheDocument()
    expect(screen.getAllByText(/1\.500/).length).toBeGreaterThan(0)
    expect(getAddressesMock).toHaveBeenCalledWith(12)
  })

  it('creates and selects a new shipping address', async () => {
    const user = userEvent.setup()
    const createdAddress: Address = {
      ...shippingAddress,
      id: 23,
      title: 'Ofis',
      district: 'Şişli',
      address_line: 'Merkez Mahallesi Büyükdere Caddesi No 10',
    }
    getAddressesMock.mockResolvedValue([])
    createAddressMock.mockResolvedValue(createdAddress)

    renderCheckout()

    await user.type(screen.getByPlaceholderText('Ev'), 'Ofis')
    await user.type(screen.getByPlaceholderText('İstanbul'), 'İstanbul')
    await user.type(screen.getByPlaceholderText('Kadıköy'), 'Şişli')
    await user.type(
      screen.getByPlaceholderText('Mahalle, sokak, bina ve daire'),
      'Merkez Mahallesi Büyükdere Caddesi No 10',
    )
    await user.type(screen.getByPlaceholderText('34710'), '34381')
    await user.click(screen.getByRole('button', { name: 'Adresi kaydet' }))

    expect(createAddressMock).toHaveBeenCalledWith(12, {
      title: 'Ofis',
      city: 'İstanbul',
      district: 'Şişli',
      address_line: 'Merkez Mahallesi Büyükdere Caddesi No 10',
      postal_code: '34381',
      address_type: 'shipping',
    })
    expect(await screen.findByText('Merkez Mahallesi Büyükdere Caddesi No 10'))
      .toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Ofis/ })).toBeChecked()
  })

  it('creates the order, starts card payment and completes local cleanup', async () => {
    const user = userEvent.setup()
    const onCompleted = vi.fn()

    renderCheckout({ onCompleted })
    await screen.findByText('Test Mahallesi Test Sokak No 1')
    await user.click(screen.getByRole('button', { name: 'Siparişi ve ödemeyi tamamla' }))

    await waitFor(() => expect(createOrderMock).toHaveBeenCalledWith({
      customer_id: 12,
      payment_method: 'credit_card',
      shipping_provider: 'standard',
      shipping_address_id: 21,
      items: [{ product_id: 7, quantity: 2 }],
    }))
    expect(startPaymentMock).toHaveBeenCalledWith(31, 'credit_card', 'tok_success')
    expect(clearCartMock).toHaveBeenCalledOnce()
    expect(onCompleted).toHaveBeenCalledOnce()
    expect(await screen.findByRole('heading', { name: 'Sonuç bekleniyor.' }))
      .toBeInTheDocument()
    expect(getCheckoutStatusMock).toHaveBeenCalledWith(31, 41)
  })

  it('does not send a card token for bank transfer', async () => {
    const user = userEvent.setup()

    renderCheckout()
    await screen.findByText('Test Mahallesi Test Sokak No 1')
    await user.click(screen.getByRole('radio', { name: /Banka havalesi/ }))

    expect(screen.queryByText('Test ödeme tokenı')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Siparişi ve ödemeyi tamamla' }))

    await waitFor(() => {
      expect(startPaymentMock).toHaveBeenCalledWith(31, 'bank_transfer', undefined)
    })
  })

  it('shows a rejected payment result and its failure reason', async () => {
    const user = userEvent.setup()
    getCheckoutStatusMock.mockResolvedValue({
      orderStatus: 'failed',
      paymentStatus: 'failed',
      failureReason: 'Kart işlemi reddedildi.',
    })

    renderCheckout()
    await screen.findByText('Test Mahallesi Test Sokak No 1')
    await user.click(screen.getByRole('button', { name: 'Siparişi ve ödemeyi tamamla' }))

    expect(await screen.findByRole('heading', { name: 'Ödeme alınamadı.' }))
      .toBeInTheDocument()
    expect(screen.getByText('Kart işlemi reddedildi.')).toBeInTheDocument()
  })

  it('keeps an accepted checkout successful when cart cleanup fails', async () => {
    const onCompleted = vi.fn()
    clearCartMock.mockRejectedValue(new Error('Cart cleanup failed'))
    getCheckoutStatusMock.mockResolvedValue({
      orderStatus: 'confirmed',
      paymentStatus: 'completed',
      failureReason: null,
    })

    renderCheckout({ onCompleted })
    await screen.findByText('Test Mahallesi Test Sokak No 1')
    fireEvent.click(screen.getByRole('button', { name: 'Siparişi ve ödemeyi tamamla' }))

    expect(await screen.findByRole('heading', { name: 'Teşekkürler.' })).toBeInTheDocument()
    expect(onCompleted).toHaveBeenCalledOnce()
  })
})
