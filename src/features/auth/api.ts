import { apiClient } from '../../api/client'
import type {
  AuthResponse,
  CurrentUser,
  LoginRequest,
  RegisterRequest,
} from './types'

export async function login(request: LoginRequest): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>('/api/v1/auth/login', request)
  return response.data
}

export async function register(request: RegisterRequest): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>('/api/v1/auth/register', request)
  return response.data
}

export async function getCurrentUser(): Promise<CurrentUser> {
  const response = await apiClient.get<CurrentUser>('/api/v1/auth/me')
  return response.data
}

export async function logout(refreshToken: string): Promise<void> {
  await apiClient.post('/api/v1/auth/logout', { refresh_token: refreshToken })
}
