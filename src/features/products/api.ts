import { apiClient } from '../../api/client'
import type { ProductFilters, ProductPage } from './types'

export async function getProducts(filters: ProductFilters): Promise<ProductPage> {
  const response = await apiClient.get<ProductPage>('/api/v1/products', {
    params: {
      page: filters.page,
      limit: 8,
      status: 'active',
      search: filters.search || undefined,
      sort: filters.sort,
    },
  })

  return response.data
}
