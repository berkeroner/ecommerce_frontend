import { apiClient } from '../../api/client'

export interface ServerCartItem {
  product_id: number
  name: string
  sku: string
  category_id: number
  category_name: string
  unit_price: number
  quantity: number
  line_total: number
  available_stock: number
}

export interface ServerCart {
  id: number
  items: ServerCartItem[]
  total_items: number
  subtotal: number
  currency: string
  updated_at: string
}

export async function getCart(): Promise<ServerCart> {
  const response = await apiClient.get<ServerCart>('/api/v1/cart')
  return response.data
}

export async function addCartItem(productId: number, quantity = 1): Promise<ServerCart> {
  const response = await apiClient.post<ServerCart>('/api/v1/cart/items', {
    product_id: productId,
    quantity,
  })
  return response.data
}

export async function updateCartItem(productId: number, quantity: number): Promise<ServerCart> {
  const response = await apiClient.put<ServerCart>(`/api/v1/cart/items/${productId}`, { quantity })
  return response.data
}

export async function removeCartItem(productId: number): Promise<ServerCart> {
  const response = await apiClient.delete<ServerCart>(`/api/v1/cart/items/${productId}`)
  return response.data
}

export async function clearCart(): Promise<void> {
  await apiClient.delete('/api/v1/cart')
}
