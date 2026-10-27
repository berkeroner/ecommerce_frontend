import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../../test/server'
import {
  createAddress,
  createOrder,
  getAddresses,
  getCheckoutStatus,
  startPayment,
} from './api'
import type { Address, OrderResult, PaymentResult } from './api'

const apiBaseUrl = 'http://localhost:8080'

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

const address: Address = {
  id: 21,
  customer_id: 12,
  address_type: 'shipping',
  title: 'Ev',
  city: 'İstanbul',
  district: 'Kadıköy',
  address_line: 'Test Mahallesi Test Sokak No 1',
  postal_code: '34710',
}

describe('checkout API', () => {
  it('creates an order with only customer, address and item data', async () => {
    let body: unknown
    let idempotencyKey: string | null = null
    server.use(
      http.post(`${apiBaseUrl}/api/v1/orders`, async ({ request }) => {
        body = await request.json()
        idempotencyKey = request.headers.get('idempotency-key')
        return HttpResponse.json({ data: order }, { status: 201 })
      }),
    )

    const result = await createOrder({
      customer_id: 12,
      shipping_address_id: 21,
      items: [{ product_id: 7, quantity: 2 }],
    })

    expect(result).toEqual(order)
    expect(body).toEqual({
      customer_id: 12,
      shipping_address_id: 21,
      items: [{ product_id: 7, quantity: 2 }],
    })
    expect(idempotencyKey).toMatch(/^[0-9a-f-]{36}$/)
    expect(body).not.toHaveProperty('payment_method')
    expect(body).not.toHaveProperty('shipping_provider')
  })

  it('sends the token only for a card payment request', async () => {
    let body: unknown
    server.use(
      http.post(`${apiBaseUrl}/api/v1/orders/31/payments`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ data: payment }, { status: 202 })
      }),
    )

    const result = await startPayment(31, 'credit_card', 'tok_success')

    expect(result).toEqual(payment)
    expect(body).toEqual({
      method: 'credit_card',
      payment_token: 'tok_success',
    })
  })

  it('omits the token for a bank transfer payment request', async () => {
    let body: unknown
    server.use(
      http.post(`${apiBaseUrl}/api/v1/orders/31/payments`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({
          data: { ...payment, method: 'bank_transfer' },
        }, { status: 202 })
      }),
    )

    await startPayment(31, 'bank_transfer')

    expect(body).toEqual({ method: 'bank_transfer' })
    expect(body).not.toHaveProperty('payment_token')
  })

  it('combines order and payment status responses', async () => {
    server.use(
      http.get(`${apiBaseUrl}/api/v1/orders/31/status`, () => HttpResponse.json({
        data: { id: 31, status: 'failed' },
      })),
      http.get(`${apiBaseUrl}/api/v1/orders/31/payments/41`, () => HttpResponse.json({
        data: {
          ...payment,
          status: 'failed',
          failure_reason: 'Kart işlemi reddedildi.',
        },
      })),
    )

    await expect(getCheckoutStatus(31, 41)).resolves.toEqual({
      orderStatus: 'failed',
      paymentStatus: 'failed',
      failureReason: 'Kart işlemi reddedildi.',
    })
  })

  it('loads addresses and sends the address creation contract', async () => {
    let body: unknown
    server.use(
      http.get(`${apiBaseUrl}/api/v1/customers/12/addresses`, () => (
        HttpResponse.json([address])
      )),
      http.post(`${apiBaseUrl}/api/v1/customers/12/addresses`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(address, { status: 201 })
      }),
    )

    await expect(getAddresses(12)).resolves.toEqual([address])
    await expect(createAddress(12, {
      address_type: 'shipping',
      title: 'Ev',
      city: 'İstanbul',
      district: 'Kadıköy',
      address_line: 'Test Mahallesi Test Sokak No 1',
      postal_code: '34710',
    })).resolves.toEqual(address)

    expect(body).toEqual({
      address_type: 'shipping',
      title: 'Ev',
      city: 'İstanbul',
      district: 'Kadıköy',
      address_line: 'Test Mahallesi Test Sokak No 1',
      postal_code: '34710',
    })
  })
})
