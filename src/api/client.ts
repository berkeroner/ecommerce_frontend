import axios from 'axios'
import type { InternalAxiosRequestConfig } from 'axios'
import { useAuthStore } from '../features/auth/store'
import type { AuthResponse } from '../features/auth/types'

const baseURL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

export const apiClient = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10_000,
})

const refreshClient = axios.create({ baseURL, timeout: 10_000 })
let pendingRefresh: Promise<AuthResponse> | null = null

interface RetryableRequest extends InternalAxiosRequestConfig {
  _retry?: boolean
}

apiClient.interceptors.request.use((config) => {
  const accessToken = useAuthStore.getState().accessToken
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const request = error.config as RetryableRequest | undefined
    const refreshToken = useAuthStore.getState().refreshToken
    const skipRefresh = ['/login', '/register', '/refresh', '/logout']
      .some((path) => request?.url?.endsWith(path))

    if (error.response?.status !== 401 || !request || request._retry || !refreshToken || skipRefresh) {
      return Promise.reject(error)
    }

    request._retry = true
    pendingRefresh ??= refreshClient
      .post<AuthResponse>('/api/v1/auth/refresh', { refresh_token: refreshToken })
      .then((response) => {
        useAuthStore.getState().setTokens(response.data)
        return response.data
      })
      .catch((refreshError) => {
        useAuthStore.getState().clearSession()
        throw refreshError
      })
      .finally(() => {
        pendingRefresh = null
      })

    const tokens = await pendingRefresh
    request.headers.Authorization = `Bearer ${tokens.access_token}`
    return apiClient(request)
  },
)
