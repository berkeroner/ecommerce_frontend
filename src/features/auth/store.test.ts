import { beforeEach, describe, expect, it } from 'vitest'
import type { CurrentUser } from './types'
import { useAuthStore } from './store'

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: null,
      refreshToken: null,
      user: null,
    })
  })

  it('stores access and refresh tokens', () => {
    useAuthStore.getState().setTokens({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      token_type: 'Bearer',
      expires_in: 900,
      refresh_expires_in: 2_592_000,
      customer_id: 12,
      role: 'customer',
    })

    expect(useAuthStore.getState().accessToken).toBe('access-token')
    expect(useAuthStore.getState().refreshToken).toBe('refresh-token')
  })

  it('stores the current user', () => {
    const user: CurrentUser = {
      user_id: 1,
      customer_id: 12,
      name: 'Test Kullanıcı',
      email: 'test@example.com',
      role: 'customer',
    }

    useAuthStore.getState().setUser(user)

    expect(useAuthStore.getState().user).toEqual(user)
  })

  it('clears the session', () => {
    useAuthStore.setState({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: {
        user_id: 1,
        customer_id: 12,
        name: 'Test Kullanıcı',
        email: 'test@example.com',
        role: 'customer',
      },
    })

    useAuthStore.getState().clearSession()

    expect(useAuthStore.getState().accessToken).toBeNull()
    expect(useAuthStore.getState().refreshToken).toBeNull()
    expect(useAuthStore.getState().user).toBeNull()
  })
})
