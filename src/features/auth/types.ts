export type UserRole = 'customer' | 'admin'

export interface AuthResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
  refresh_expires_in: number
  customer_id: number | null
  role: UserRole
}

export interface CurrentUser {
  name: string | null
  user_id: number
  customer_id: number | null
  email: string
  role: UserRole
}

export interface LoginRequest {
  email: string
  password: string
}

export interface RegisterRequest extends LoginRequest {
  name: string
}
