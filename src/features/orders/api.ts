import { apiClient } from '../../api/client'
import type { OrderStatus, PaymentStatus } from '../checkout/api'

export interface CustomerOrder {
  id: number
  order_no: string
  status: OrderStatus
  payment_status: PaymentStatus | null
  total_amount: number
  currency: string
  created_at: string
}

export interface OrdersPageResponse {
  data: CustomerOrder[]
  page: number
  limit: number
  total_elements: number
  total_pages: number
}

export async function getCustomerOrders(
  customerId: number,
  page: number,
): Promise<OrdersPageResponse> {
  const response = await apiClient.get<OrdersPageResponse>('/api/v1/orders', {
    params: { customer_id: customerId, page, limit: 10 },
  })
  return response.data
}
