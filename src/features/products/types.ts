export type ProductStatus = 'active' | 'passive'

export interface Product {
  id: number
  category_id: number
  category_name: string
  name: string
  sku: string
  price: number
  stock: number
  status: ProductStatus
  created_at: string
  updated_at: string
}

export interface ProductPage {
  data: Product[]
  page: number
  limit: number
  total_elements: number
  total_pages: number
}

export interface ProductFilters {
  page: number
  search: string
  sort: string
}
