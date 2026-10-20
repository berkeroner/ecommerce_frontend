import { beforeEach, describe, expect, it } from 'vitest'
import type { CartProduct } from './store'
import { useCartStore } from './store'

const product: CartProduct = {
  id: 1,
  category_id: 10,
  category_name: 'Elektronik',
  name: 'Kulaklık',
  sku: 'ELK-001',
  price: 750,
  stock: 2,
}

describe('useCartStore', () => {
  beforeEach(() => {
    useCartStore.setState({ items: [] })
  })

  it('adds a product to the cart', () => {
    useCartStore.getState().addItem(product)

    expect(useCartStore.getState().items).toEqual([
      { product, quantity: 1 },
    ])
  })

  it('does not exceed available stock', () => {
    useCartStore.getState().addItem(product)
    useCartStore.getState().addItem(product)
    useCartStore.getState().addItem(product)

    expect(useCartStore.getState().items[0]?.quantity).toBe(2)
  })

  it('does not add an out-of-stock product', () => {
    useCartStore.getState().addItem({
      ...product,
      stock: 0,
    })

    expect(useCartStore.getState().items).toEqual([])
  })

  it('removes a product when its quantity becomes zero', () => {
    useCartStore.getState().addItem(product)
    useCartStore.getState().setQuantity(product.id, 0)

    expect(useCartStore.getState().items).toEqual([])
  })

  it('clears the cart', () => {
    useCartStore.getState().addItem(product)
    useCartStore.getState().clearCart()

    expect(useCartStore.getState().items).toEqual([])
  })
})
