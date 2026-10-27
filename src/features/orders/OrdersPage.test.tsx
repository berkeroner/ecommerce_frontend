import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CurrentUser } from '../auth/types'
import type { OrdersPageResponse } from './api'
import { getCustomerOrders } from './api'
import { OrdersPage } from './OrdersPage'

vi.mock('./api', () => ({
  getCustomerOrders: vi.fn(),
}))

const getCustomerOrdersMock = vi.mocked(getCustomerOrders)

const customer: CurrentUser = {
  user_id: 1,
  customer_id: 12,
  name: 'Test Kullanıcı',
  email: 'test@example.com',
  role: 'customer',
}

const emptyOrders: OrdersPageResponse = {
  data: [],
  page: 1,
  limit: 10,
  total_elements: 0,
  total_pages: 0,
}

function ordersPage(
  data: OrdersPageResponse['data'],
  page = 1,
  totalPages = 1,
): OrdersPageResponse {
  return {
    data,
    page,
    limit: 10,
    total_elements: data.length,
    total_pages: totalPages,
  }
}

function renderOrdersPage(
  user: CurrentUser | null = customer,
  onRequireAuth = vi.fn(),
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
      },
    },
  })

  return {
    onRequireAuth,
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/orders']}>
          <OrdersPage user={user} onRequireAuth={onRequireAuth} />
        </MemoryRouter>
      </QueryClientProvider>,
    ),
  }
}

describe('OrdersPage', () => {
  beforeEach(() => {
    getCustomerOrdersMock.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('asks unauthenticated users to sign in', () => {
    const onRequireAuth = vi.fn()

    renderOrdersPage(null, onRequireAuth)
    fireEvent.click(screen.getByRole('button', { name: 'Giriş yap veya kayıt ol' }))

    expect(screen.getByRole('heading', {
      name: 'Siparişlerini görmek için giriş yap.',
    })).toBeInTheDocument()
    expect(onRequireAuth).toHaveBeenCalledOnce()
    expect(getCustomerOrdersMock).not.toHaveBeenCalled()
  })

  it('does not load orders for an admin account without a customer', () => {
    renderOrdersPage({
      user_id: 2,
      customer_id: null,
      name: 'Yönetici',
      email: 'admin@example.com',
      role: 'admin',
    })

    expect(screen.getByRole('heading', { name: 'Müşteri hesabı gerekli.' })).toBeInTheDocument()
    expect(screen.getByText('Yönetici hesaplarının müşteri sipariş geçmişi bulunmaz.'))
      .toBeInTheDocument()
    expect(getCustomerOrdersMock).not.toHaveBeenCalled()
  })

  it('shows a loading state while orders are pending', () => {
    getCustomerOrdersMock.mockReturnValue(new Promise(() => {}))

    renderOrdersPage()

    expect(screen.getByText('Siparişlerin yükleniyor…')).toBeInTheDocument()
    expect(getCustomerOrdersMock).toHaveBeenCalledWith(customer.customer_id, 1)
  })

  it('shows an error and allows the request to be retried', async () => {
    const user = userEvent.setup()
    getCustomerOrdersMock
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(emptyOrders)

    renderOrdersPage()

    expect(await screen.findByRole('alert')).toHaveTextContent('Siparişler alınamadı.')
    await user.click(screen.getByRole('button', { name: 'Tekrar dene' }))

    expect(await screen.findByRole('heading', { name: 'Henüz siparişin yok.' }))
      .toBeInTheDocument()
    expect(getCustomerOrdersMock).toHaveBeenCalledTimes(2)
  })

  it('shows an empty state when the customer has no orders', async () => {
    getCustomerOrdersMock.mockResolvedValue(emptyOrders)

    renderOrdersPage()

    expect(await screen.findByRole('heading', { name: 'Henüz siparişin yok.' }))
      .toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ürünleri keşfet →' }))
      .toHaveAttribute('href', '/#products')
  })

  it('renders order amount and translated statuses', async () => {
    getCustomerOrdersMock.mockResolvedValue(ordersPage([{
      id: 31,
      order_no: 'ORD-2026-31',
      status: 'confirmed',
      payment_status: 'completed',
      total_amount: 1_250,
      currency: 'TRY',
      created_at: '2026-10-20T10:30:00',
    }]))

    renderOrdersPage()

    expect(await screen.findByRole('heading', { name: 'ORD-2026-31' })).toBeInTheDocument()
    expect(screen.getByText(new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      maximumFractionDigits: 2,
    }).format(1_250))).toBeInTheDocument()
    expect(screen.getByText('Ödendi')).toBeInTheDocument()
    expect(screen.getByText('Onaylandı')).toBeInTheDocument()
  })

  it('loads the next order page and updates pagination controls', async () => {
    const user = userEvent.setup()
    getCustomerOrdersMock.mockImplementation((_customerId, page) => Promise.resolve(
      ordersPage([{
        id: page,
        order_no: `ORD-PAGE-${page}`,
        status: 'confirmed',
        payment_status: 'completed',
        total_amount: page * 100,
        currency: 'TRY',
        created_at: '2026-10-20T10:30:00',
      }], page, 2),
    ))

    renderOrdersPage()

    expect(await screen.findByRole('heading', { name: 'ORD-PAGE-1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '← Önceki' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Sonraki →' }))

    expect(await screen.findByRole('heading', { name: 'ORD-PAGE-2' })).toBeInTheDocument()
    expect(screen.getByText('2 / 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sonraki →' })).toBeDisabled()
    expect(getCustomerOrdersMock).toHaveBeenLastCalledWith(customer.customer_id, 2)
  })

  it('polls again while an order payment is pending', async () => {
    vi.useFakeTimers()
    getCustomerOrdersMock.mockResolvedValue(ordersPage([{
      id: 44,
      order_no: 'ORD-PENDING-44',
      status: 'processing',
      payment_status: 'pending',
      total_amount: 500,
      currency: 'TRY',
      created_at: '2026-10-20T10:30:00',
    }]))

    renderOrdersPage()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(screen.getByRole('heading', { name: 'ORD-PENDING-44' })).toBeInTheDocument()
    expect(getCustomerOrdersMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000)
    })

    expect(getCustomerOrdersMock).toHaveBeenCalledTimes(2)
  })
})
