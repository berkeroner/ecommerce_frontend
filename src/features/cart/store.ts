import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { Product } from '../products/types'

export type CartProduct = Pick<Product,
  'id' | 'category_id' | 'category_name' | 'name' | 'sku' | 'price' | 'stock'>

export interface CartItem {
  product: CartProduct
  quantity: number
}

interface CartState {
  items: CartItem[]
  addItem: (product: CartProduct) => void
  setQuantity: (productId: number, quantity: number) => void
  removeItem: (productId: number) => void
  clearCart: () => void
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      addItem: (product) => set((state) => {
        if (product.stock < 1) return state

        const existing = state.items.find((item) => item.product.id === product.id)
        if (!existing) return { items: [...state.items, { product, quantity: 1 }] }

        return {
          items: state.items.map((item) => item.product.id === product.id
            ? { ...item, product, quantity: Math.min(item.quantity + 1, product.stock) }
            : item),
        }
      }),
      setQuantity: (productId, quantity) => set((state) => ({
        items: quantity <= 0
          ? state.items.filter((item) => item.product.id !== productId)
          : state.items.map((item) => item.product.id === productId
              ? { ...item, quantity: Math.min(Math.max(1, quantity), item.product.stock) }
              : item),
      })),
      removeItem: (productId) => set((state) => ({
        items: state.items.filter((item) => item.product.id !== productId),
      })),
      clearCart: () => set({ items: [] }),
    }),
    {
      name: 'dukkan-cart',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
