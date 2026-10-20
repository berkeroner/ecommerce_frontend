import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import axios from 'axios'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { getCurrentUser, login, register } from './api'
import { useAuthStore } from './store'

const authSchema = z.object({
  name: z.string(),
  email: z.email('Geçerli bir e-posta adresi yazmalısın.'),
  password: z.string().min(8, 'Şifre en az 8 karakter olmalı.').max(72),
})

type AuthForm = z.infer<typeof authSchema>
type AuthMode = 'login' | 'register'

interface AuthDialogProps {
  open: boolean
  onClose: () => void
}

function getErrorMessage(error: unknown) {
  if (!axios.isAxiosError(error)) return 'Beklenmeyen bir hata oluştu.'

  const message = error.response?.data?.error?.message
  if (message === 'Invalid email or password') return 'E-posta veya şifre hatalı.'
  if (message === 'Email is already registered') return 'Bu e-posta zaten kayıtlı.'
  return message ?? 'Sunucuya bağlanılamadı. Lütfen tekrar dene.'
}

export function AuthDialog({ open, onClose }: AuthDialogProps) {
  const [mode, setMode] = useState<AuthMode>('login')
  const setTokens = useAuthStore((state) => state.setTokens)
  const setUser = useAuthStore((state) => state.setUser)
  const clearSession = useAuthStore((state) => state.clearSession)
  const {
    register: registerField,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<AuthForm>({
    resolver: zodResolver(authSchema),
    defaultValues: { name: '', email: '', password: '' },
  })

  const authMutation = useMutation({
    mutationFn: async (values: AuthForm) => {
      if (mode === 'register' && values.name.trim().length < 2) {
        throw new Error('NAME_REQUIRED')
      }

      const tokens = mode === 'login'
        ? await login({ email: values.email, password: values.password })
        : await register({
            name: values.name.trim(),
            email: values.email,
            password: values.password,
          })

      setTokens(tokens)
      try {
        const currentUser = await getCurrentUser()
        setUser(currentUser)
      } catch (error) {
        clearSession()
        throw error
      }
    },
    onSuccess: () => {
      reset()
      onClose()
    },
    onError: (error) => {
      if (error instanceof Error && error.message === 'NAME_REQUIRED') {
        setError('name', { message: 'Ad soyad en az 2 karakter olmalı.' })
      }
    },
  })

  useEffect(() => {
    if (!open) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [open, onClose])

  if (!open) return null

  const changeMode = (nextMode: AuthMode) => {
    setMode(nextMode)
    authMutation.reset()
    reset()
  }

  return (
    <div className="auth-backdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose()
    }}>
      <section className="auth-dialog" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button className="auth-close" type="button" onClick={onClose} aria-label="Pencereyi kapat">×</button>
        <p className="section-number">Hesabın</p>
        <h2 id="auth-title">{mode === 'login' ? 'Tekrar hoş geldin.' : 'Aramıza katıl.'}</h2>
        <p className="auth-intro">
          {mode === 'login'
            ? 'Siparişlerini ve adreslerini yönetmek için giriş yap.'
            : 'Alışverişe başlamak için hesabını birkaç saniyede oluştur.'}
        </p>

        <div className="auth-tabs" role="tablist" aria-label="Hesap işlemleri">
          <button type="button" role="tab" aria-selected={mode === 'login'} onClick={() => changeMode('login')}>
            Giriş yap
          </button>
          <button type="button" role="tab" aria-selected={mode === 'register'} onClick={() => changeMode('register')}>
            Kayıt ol
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit((values) => authMutation.mutate(values))} noValidate>
          {mode === 'register' && (
            <label>
              <span>Ad soyad</span>
              <input autoComplete="name" placeholder="Adnan Yılmaz" {...registerField('name')} />
              {errors.name && <small>{errors.name.message}</small>}
            </label>
          )}
          <label>
            <span>E-posta</span>
            <input type="email" autoComplete="email" placeholder="adnan.yilmaz@example.com" {...registerField('email')} />
            {errors.email && <small>{errors.email.message}</small>}
          </label>
          <label>
            <span>Şifre</span>
            <input
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              placeholder="En az 8 karakter"
              {...registerField('password')}
            />
            {errors.password && <small>{errors.password.message}</small>}
          </label>

          {authMutation.isError && !(authMutation.error instanceof Error && authMutation.error.message === 'NAME_REQUIRED') && (
            <p className="auth-error" role="alert">{getErrorMessage(authMutation.error)}</p>
          )}

          <button className="auth-submit" type="submit" disabled={authMutation.isPending}>
            {authMutation.isPending
              ? 'Lütfen bekle…'
              : mode === 'login' ? 'Giriş yap' : 'Hesap oluştur'}
          </button>
        </form>
      </section>
    </div>
  )
}
