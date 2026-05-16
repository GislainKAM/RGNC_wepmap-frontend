'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'
import { useLanguage } from '@/hooks/useLanguage'
import { Icon } from '@/components/ui/Icon'
import { Button } from '@/components/ui/Button'
import { ROUTES } from '@/lib/constants'

const loginSchema = z.object({
  username: z.string().min(1, 'Identifiant requis'),
  password: z.string().min(1, 'Mot de passe requis'),
})

type LoginData = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router     = useRouter()
  const login      = useAuth((s) => s.login)
  const isLoading  = useAuth((s) => s.isLoading)
  const authError  = useAuth((s) => s.error)
  const clearError = useAuth((s) => s.clearError)
  const { t }      = useLanguage()

  const { register, handleSubmit, formState: { errors } } = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginData) => {
    clearError()
    try {
      await login(data)
      router.push(ROUTES.MAP)
    } catch {
      // error set in store
    }
  }

  return (
    <div className="login-screen">

      {/* ── Panneau illustration gauche ── */}
      <div className="login-illustration">
        {/* Pattern réticule de fond — asset SVG officiel */}
        <div className="reticle-bg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/patterns/reticle.svg" alt="" />
        </div>

        <div className="login-quote">
          {/* Logo mark RGNC WebMap officiel */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="login-mark"
            src="/assets/logo/rgnc-webmap-mark.svg"
            alt="RGNC WebMap"
            style={{ filter: 'brightness(0) invert(1) opacity(0.92)' }}
          />

          <h2 className="login-tagline">{t('login.tagline')}</h2>
          <p className="login-sub">{t('login.sub')}</p>
        </div>
      </div>

      {/* ── Formulaire droite ── */}
      <div className="login-form-wrap">
        <form className="login-form" onSubmit={handleSubmit(onSubmit)} noValidate>

          {/* Co-branding MINDCAF officiel — clique → site MINDCAF */}
          <div className="login-cobrand">
            <a href="https://mindcaf.cm" target="_blank" rel="noopener noreferrer" title="Ministère des Domaines, du Cadastre et des Affaires Foncières">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/logo/mindcaf-cobrand.svg" alt="MINDCAF" style={{ cursor: 'pointer' }} />
            </a>
          </div>

          <h1>{t('login.title')}</h1>
          <p className="login-form-sub">{t('login.subtitle')}</p>

          {authError && (
            <div className="login-error" role="alert">
              <Icon name="triangle-alert" size={14} />
              {authError}
            </div>
          )}

          <div className="field">
            <label htmlFor="username">{t('login.username')}</label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              placeholder="ex. a.mballa"
              {...register('username')}
            />
            {errors.username && (
              <span style={{ fontSize: 11, color: 'var(--rgnc-danger)', display: 'block', marginTop: 3 }}>
                {errors.username.message}
              </span>
            )}
          </div>

          <div className="field">
            <label htmlFor="password">{t('login.password')}</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              {...register('password')}
            />
            {errors.password && (
              <span style={{ fontSize: 11, color: 'var(--rgnc-danger)', display: 'block', marginTop: 3 }}>
                {errors.password.message}
              </span>
            )}
            <span className="forgot">{t('login.forgot')}</span>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full"
            style={{ marginTop: 16, height: 42, fontSize: 14 }}
            disabled={isLoading}
          >
            {isLoading ? t('login.loading') : t('login.submit')}
          </button>

          <div className="login-foot">
            {t('login.footer')}{' '}
            <Link href={ROUTES.REGISTER} style={{ color: 'var(--rgnc-foret-700)', fontWeight: 500 }}>
              {t('login.register')}
            </Link>
            <br /><br />
            v2.4.0 · Données mises à jour le 14 mai 2026
          </div>
        </form>
      </div>
    </div>
  )
}
