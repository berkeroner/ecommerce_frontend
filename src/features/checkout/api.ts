import { apiClient } from '../../api/client'

export type PaymentMethod = 'credit_card' | 'bank_transfer' | 'cash_on_delivery'
export type OrderStatus = 'pending' | 'processing' | 'confirmed' | 'failed' | 'cancelled'
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded'

export interface Address {
  id: number
  customer_id: number
  address_type: 'shipping' | 'billing'
  title: string
  city: string
  district: string
  address_line: string
  postal_code: string | null
}

export interface AddressRequest {
  address_type: 'shipping' | 'billing'
  title: string
  city: string
  district: string
  address_line: string
  postal_code?: string
}

export interface OrderResult {
  id: number
  order_no: string
  status: OrderStatus
  total_amount: number
  currency: string
}

export interface PaymentResult {
  id: number
  payment_no: string
  order_id: number
  method: PaymentMethod
  provider: string
  status: PaymentStatus
  amount: number
  transaction_id: string | null
  failure_reason: string | null
}

interface DataResponse<T> {
  data: T
}

export async function getAddresses(customerId: number): Promise<Address[]> {
  const response = await apiClient.get<Address[]>(`/api/v1/customers/${customerId}/addresses`)
  return response.data
}

export async function createAddress(customerId: number, request: AddressRequest): Promise<Address> {
  const response = await apiClient.post<Address>(`/api/v1/customers/${customerId}/addresses`, request)
  return response.data
}

export async function createOrder(request: {
  customer_id: number
  shipping_address_id: number
  items: Array<{ product_id: number; quantity: number }>
}): Promise<OrderResult> {
  const response = await apiClient.post<DataResponse<OrderResult>>('/api/v1/orders', request, {
    headers: { 'Idempotency-Key': crypto.randomUUID() },
  })
  return response.data.data
}

export async function startPayment(
  orderId: number,
  method: PaymentMethod,
  paymentToken?: string,
): Promise<PaymentResult> {
  const response = await apiClient.post<DataResponse<PaymentResult>>(
    `/api/v1/orders/${orderId}/payments`,
    { method, payment_token: paymentToken || undefined },
  )
  return response.data.data
}

export async function getCheckoutStatus(orderId: number, paymentId: number): Promise<{
  orderStatus: OrderStatus
  paymentStatus: PaymentStatus
  failureReason: string | null
}> {
  const [orderResponse, paymentResponse] = await Promise.all([
    apiClient.get<DataResponse<{ id: number; status: OrderStatus }>>(`/api/v1/orders/${orderId}/status`),
    apiClient.get<DataResponse<PaymentResult>>(`/api/v1/orders/${orderId}/payments/${paymentId}`),
  ])
  return {
    orderStatus: orderResponse.data.data.status,
    paymentStatus: paymentResponse.data.data.status,
    failureReason: paymentResponse.data.data.failure_reason,
  }
}
