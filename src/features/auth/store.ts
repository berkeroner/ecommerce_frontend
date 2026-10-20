import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { AuthResponse, CurrentUser } from './types'

interface AuthState {
  accessToken: string | null
  refreshToken: string | null
  user: CurrentUser | null
  setTokens: (tokens: AuthResponse) => void
  setUser: (user: CurrentUser) => void
  clearSession: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setTokens: (tokens) => set({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
      }),
      setUser: (user) => set({ user }),
      clearSession: () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    {
      name: 'dukkan-auth',
      storage: createJSONStorage(() => sessionStorage),
      partialize: ({ accessToken, refreshToken, user }) => ({ accessToken, refreshToken, user }),
    },
  ),
)
