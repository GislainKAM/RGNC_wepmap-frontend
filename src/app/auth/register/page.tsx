'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@/hooks/useAuth'
import { useLanguage } from '@/hooks/useLanguage'
import { Icon } from '@/components/ui/Icon'
import { Button } from '@/components/ui/Button'
import { ROUTES, REGIONS_CM } from '@/lib/constants'

const registerSchema = z.object({
  first_name:        z.string().min(1, 'Prénom requis'),
  last_name:         z.string().min(1, 'Nom requis'),
  username:          z.string().min(3, 'Identifiant : min 3 caractères').regex(/^\w+$/, 'Lettres, chiffres et _ uniquement'),
  email:             z.string().email('Email invalide'),
  password:          z.string().min(8, 'Mot de passe : min 8 caractères'),
  organisation:      z.string().min(1, 'Organisation requise'),
  telephone:         z.string().optional(),
  numero_ordre:      z.string().optional(),
  region_principale: z.string().optional(),
})

type RegisterData = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const register_auth  = useAuth((s) => s.register)
  const isLoading      = useAuth((s) => s.isLoading)
  const authError      = useAuth((s) => s.error)
  const clearError     = useAuth((s) => s.clearError)
  const [success, setSuccess] = useState(false)
  const { t } = useLanguage()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterData>({ resolver: zodResolver(registerSchema) })

  const onSubmit = async (data: RegisterData) => {
    clearError()
    try {
      await register_auth({
        ...data,
        region_principale: data.region_principale ? Number(data.region_principale) : null,
      } as any)
      setSuccess(true)
    } catch {
      // error set in store
    }
  }

  if (success) {
    return (
      <div className="login-screen" data-nextjs-scroll-focus-boundary>
        {/* Panneau gauche même que login */}
        <div className="login-illustration">
          <div className="reticle-bg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/patterns/reticle.svg" alt="" />
          </div>
          <div className="login-quote">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="login-mark" src="/assets/logo/rgnc-webmap-mark.svg" alt="RGNC WebMap"
              style={{ filter: 'brightness(0) invert(1) opacity(0.92)' }} />
            <h2 className="login-tagline">{t('register.tagline')}</h2>
            <p className="login-sub">{t('register.sub')}</p>
          </div>
        </div>

        {/* Confirmation droite */}
        <div className="login-form-wrap">
          <div style={{ width: '100%', maxWidth: 360, textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--rgnc-success-bg)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
              <Icon name="check" size={28} color="var(--rgnc-success)" strokeWidth={2.5} />
            </div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600, margin: '0 0 8px', letterSpacing: '-0.01em' }}>
              Demande envoyée
            </h2>
            <p style={{ fontSize: 14, color: 'var(--fg-2)', lineHeight: 1.65, margin: '0 0 24px' }}>
              Votre demande a été transmise à la <strong>Cellule SIG du MINDCAF</strong>.
              Vous serez contacté sous 5 à 10 jours ouvrables.
            </p>
            <div style={{ background: 'var(--rgnc-info-bg)', border: '1px solid #A8C8E0', borderRadius: 'var(--radius-sm)', padding: '10px 14px', marginBottom: 22, textAlign: 'left', display: 'flex', gap: 9 }}>
              <Icon name="info" size={14} color="var(--rgnc-info)" />
              <p style={{ fontSize: 12, color: '#0C3A5A', margin: 0, lineHeight: 1.6 }}>
                En cas de besoin urgent : <strong>sig@mindcaf.cm</strong>
              </p>
            </div>
            <Link href={ROUTES.LOGIN} className="btn btn-primary btn-full" style={{ height: 42, fontSize: 14 }}>
              Retour à la connexion
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="login-screen">
      {/* ── Panneau illustration gauche ── */}
      <div className="login-illustration">
        <div className="reticle-bg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/patterns/reticle.svg" alt="" />
        </div>
        <div className="login-quote">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="login-mark" src="/assets/logo/rgnc-webmap-mark.svg" alt="RGNC WebMap"
            style={{ filter: 'brightness(0) invert(1) opacity(0.92)' }} />
          <h2 className="login-tagline">{t('register.tagline')}</h2>
          <p className="login-sub">{t('register.sub')}</p>
        </div>
      </div>

      {/* ── Formulaire droite ── */}
      <div className="login-form-wrap" style={{ overflowY: 'auto' }}>
        <div className="login-form" style={{ maxWidth: 440 }}>
          <div className="login-cobrand">
            <a href="https://mindcaf.cm" target="_blank" rel="noopener noreferrer" title="Ministère des Domaines, du Cadastre et des Affaires Foncières">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/logo/mindcaf-cobrand.svg" alt="MINDCAF" style={{ cursor: 'pointer' }} />
            </a>
          </div>

          <h1 style={{ fontSize: 22 }}>{t('register.title')}</h1>
          <p className="login-form-sub">{t('register.subtitle')}</p>

          {/* Bandeau info */}
          <div style={{ background: 'var(--rgnc-info-bg)', border: '1px solid #A8C8E0', borderRadius: 'var(--radius-sm)', padding: '10px 12px', marginBottom: 16, display: 'flex', gap: 9, alignItems: 'flex-start' }}>
            <Icon name="info" size={14} color="var(--rgnc-info)" />
            <p style={{ fontSize: 12, color: '#0C3A5A', margin: 0, lineHeight: 1.6 }}>
              {t('register.info')}
            </p>
          </div>

          {authError && (
            <div className="login-error" role="alert">
              <Icon name="triangle-alert" size={14} />
              {authError}
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} noValidate>
            {/* Name row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="field">
                <label htmlFor="first_name">Prénom *</label>
                <input id="first_name" type="text" placeholder="Jean" {...register('first_name')} />
                {errors.first_name && <span style={{ fontSize: 11, color: 'var(--rgnc-danger)', display: 'block', marginTop: 3 }}>{errors.first_name.message}</span>}
              </div>
              <div className="field">
                <label htmlFor="last_name">Nom *</label>
                <input id="last_name" type="text" placeholder="Dupont" {...register('last_name')} />
                {errors.last_name && <span style={{ fontSize: 11, color: 'var(--rgnc-danger)', display: 'block', marginTop: 3 }}>{errors.last_name.message}</span>}
              </div>
            </div>

            <div className="field">
              <label htmlFor="username">Identifiant *</label>
              <input id="username" type="text" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck="false" placeholder="jean_dupont" {...register('username')} />
              {errors.username && <span style={{ fontSize: 11, color: 'var(--rgnc-danger)', display: 'block', marginTop: 3 }}>{errors.username.message}</span>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="field">
                <label htmlFor="email">Email professionnel *</label>
                <input id="email" type="email" autoComplete="email" placeholder="j.dupont@mindcaf.cm" {...register('email')} />
                {errors.email && <span style={{ fontSize: 11, color: 'var(--rgnc-danger)', display: 'block', marginTop: 3 }}>{errors.email.message}</span>}
              </div>
              <div className="field">
                <label htmlFor="telephone">Téléphone</label>
                <input id="telephone" type="tel" placeholder="+237 6XX XXX XXX" {...register('telephone')} />
              </div>
            </div>

            <div className="field">
              <label htmlFor="password">Mot de passe *</label>
              <input id="password" type="password" autoComplete="new-password" placeholder="Min. 8 caractères" {...register('password')} />
              {errors.password && <span style={{ fontSize: 11, color: 'var(--rgnc-danger)', display: 'block', marginTop: 3 }}>{errors.password.message}</span>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="field">
                <label htmlFor="organisation">Organisme / Institution *</label>
                <input id="organisation" type="text" placeholder="MINDCAF, Cabinet géomètre…" {...register('organisation')} />
                {errors.organisation && <span style={{ fontSize: 11, color: 'var(--rgnc-danger)', display: 'block', marginTop: 3 }}>{errors.organisation.message}</span>}
              </div>
              <div className="field">
                <label htmlFor="numero_ordre">N° Ordre géomètre</label>
                <input id="numero_ordre" type="text" placeholder="Optionnel" {...register('numero_ordre')} />
              </div>
            </div>

            <div className="field">
              <label htmlFor="region_principale">Région principale</label>
              <select id="region_principale" {...register('region_principale')}>
                <option value="">— Sélectionner une région —</option>
                {REGIONS_CM.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.nom}
                  </option>
                ))}
              </select>
            </div>

            <Button type="submit" fullWidth loading={isLoading} style={{ marginTop: 8 }}>
              {isLoading ? t('register.loading') : t('register.submit')}
              {!isLoading && <Icon name="arrow-right" size={14} />}
            </Button>
          </form>

          <div className="login-foot">
            {t('register.accredite')}{' '}
            <Link href={ROUTES.LOGIN} style={{ color: 'var(--rgnc-foret-700)', fontWeight: 500, textDecoration: 'none' }}>
              {t('register.login')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
