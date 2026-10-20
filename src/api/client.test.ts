import { delay, http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'
import { useAuthStore } from '../features/auth/store'
import type { AuthResponse } from '../features/auth/types'
import { server } from '../test/server'
import { apiClient } from './client'

const apiBaseUrl = 'http://localhost:8080'

const refreshedTokens: AuthResponse = {
  access_token: 'refreshed-access-token',
  refresh_token: 'refreshed-refresh-token',
  token_type: 'Bearer',
  expires_in: 900,
  refresh_expires_in: 2_592_000,
  customer_id: 12,
  role: 'customer',
}

describe('apiClient authentication', () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: null,
      refreshToken: null,
      user: null,
    })
  })

  it('adds the access token to the Authorization header', async () => {
    useAuthStore.setState({ accessToken: 'access-token' })
    server.use(
      http.get(`${apiBaseUrl}/api/v1/protected`, ({ request }) => HttpResponse.json({
        authorization: request.headers.get('authorization'),
      })),
    )

    const response = await apiClient.get<{ authorization: string }>('/api/v1/protected')

    expect(response.data.authorization).toBe('Bearer access-token')
  })

  it('refreshes an expired token and retries the original request', async () => {
    let refreshCalls = 0
    let protectedCalls = 0
    useAuthStore.setState({
      accessToken: 'expired-access-token',
      refreshToken: 'current-refresh-token',
    })
    server.use(
      http.get(`${apiBaseUrl}/api/v1/protected`, ({ request }) => {
        protectedCalls += 1
        if (request.headers.get('authorization') !== 'Bearer refreshed-access-token') {
          return HttpResponse.json({ error: 'unauthorized' }, { status: 401 })
        }
        return HttpResponse.json({ value: 'protected-value' })
      }),
      http.post(`${apiBaseUrl}/api/v1/auth/refresh`, async ({ request }) => {
        refreshCalls += 1
        expect(await request.json()).toEqual({ refresh_token: 'current-refresh-token' })
        return HttpResponse.json(refreshedTokens)
      }),
    )

    const response = await apiClient.get<{ value: string }>('/api/v1/protected')

    expect(response.data.value).toBe('protected-value')
    expect(refreshCalls).toBe(1)
    expect(protectedCalls).toBe(2)
    expect(useAuthStore.getState().accessToken).toBe('refreshed-access-token')
    expect(useAuthStore.getState().refreshToken).toBe('refreshed-refresh-token')
  })

  it('shares one refresh request between concurrent unauthorized responses', async () => {
    let refreshCalls = 0
    useAuthStore.setState({
      accessToken: 'expired-access-token',
      refreshToken: 'current-refresh-token',
    })
    server.use(
      http.get(`${apiBaseUrl}/api/v1/protected/:resource`, ({ request, params }) => {
        if (request.headers.get('authorization') !== 'Bearer refreshed-access-token') {
          return HttpResponse.json({ error: 'unauthorized' }, { status: 401 })
        }
        return HttpResponse.json({ resource: params.resource })
      }),
      http.post(`${apiBaseUrl}/api/v1/auth/refresh`, async () => {
        refreshCalls += 1
        await delay(25)
        return HttpResponse.json(refreshedTokens)
      }),
    )

    const [first, second] = await Promise.all([
      apiClient.get<{ resource: string }>('/api/v1/protected/first'),
      apiClient.get<{ resource: string }>('/api/v1/protected/second'),
    ])

    expect(first.data.resource).toBe('first')
    expect(second.data.resource).toBe('second')
    expect(refreshCalls).toBe(1)
  })

  it('clears the session when token refresh fails', async () => {
    useAuthStore.setState({
      accessToken: 'expired-access-token',
      refreshToken: 'invalid-refresh-token',
      user: {
        user_id: 1,
        customer_id: 12,
        name: 'Test Kullanıcı',
        email: 'test@example.com',
        role: 'customer',
      },
    })
    server.use(
      http.get(`${apiBaseUrl}/api/v1/protected`, () => (
        HttpResponse.json({ error: 'unauthorized' }, { status: 401 })
      )),
      http.post(`${apiBaseUrl}/api/v1/auth/refresh`, () => (
        HttpResponse.json({ error: 'invalid refresh token' }, { status: 401 })
      )),
    )

    await expect(apiClient.get('/api/v1/protected')).rejects.toBeDefined()

    expect(useAuthStore.getState().accessToken).toBeNull()
    expect(useAuthStore.getState().refreshToken).toBeNull()
    expect(useAuthStore.getState().user).toBeNull()
  })

  it.each(['login', 'register', 'refresh', 'logout'])(
    'does not try to refresh a failed %s request',
    async (endpoint) => {
      let refreshCalls = 0
      useAuthStore.setState({
        accessToken: 'expired-access-token',
        refreshToken: 'current-refresh-token',
      })
      server.use(
        http.post(`${apiBaseUrl}/api/v1/auth/${endpoint}`, () => (
          HttpResponse.json({ error: 'unauthorized' }, { status: 401 })
        )),
        http.post(`${apiBaseUrl}/api/v1/auth/refresh`, () => {
          refreshCalls += 1
          return HttpResponse.json(refreshedTokens)
        }),
      )

      await expect(apiClient.post(`/api/v1/auth/${endpoint}`)).rejects.toBeDefined()

      expect(refreshCalls).toBe(0)
    },
  )
})
