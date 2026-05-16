'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { fr as frLocale, enUS } from 'date-fns/locale'
import { useAuth } from '@/hooks/useAuth'
import { useLanguage } from '@/hooks/useLanguage'
import { Icon } from '@/components/ui/Icon'
import { Button } from '@/components/ui/Button'
import { profilApi } from '@/lib/api'
import { ROUTES, REGIONS_CM } from '@/lib/constants'

const MAX_PHOTO_SIZE = 5 * 1024 * 1024   // 5 Mo
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

// ── Helpers ───────────────────────────────────────────────────────

/** Initiales depuis un nom complet ou username */
function initials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

/** Petit composant champ lecture seule */
function FieldRO({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </span>
      <span style={{ fontSize: 14, color: 'var(--fg-1)', fontWeight: 500 }}>
        {value ?? <span style={{ color: 'var(--fg-4)' }}>—</span>}
      </span>
    </div>
  )
}

/** Toast inline */
function InlineToast({ msg, type, onClose }: { msg: string; type: 'success' | 'danger'; onClose: () => void }) {
  const bg  = type === 'success' ? 'var(--rgnc-success-bg)' : 'var(--rgnc-danger-bg)'
  const col = type === 'success' ? 'var(--rgnc-success)'    : 'var(--rgnc-danger)'
  const icon = type === 'success' ? 'check-circle' : 'alert-circle'
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: bg, border: `1px solid ${col}`,
      borderRadius: 'var(--radius-sm)', padding: '10px 14px',
      fontSize: 13, color: col,
    }}>
      <Icon name={icon as any} size={15} />
      <span style={{ flex: 1 }}>{msg}</span>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: col, padding: 2, display: 'flex' }}>
        <Icon name="x" size={14} />
      </button>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────

export default function ProfilPage() {
  const router      = useRouter()
  const { t, lang } = useLanguage()
  const dateLocale  = lang === 'fr' ? frLocale : enUS

  const user          = useAuth((s) => s.user)
  const isAuth        = useAuth((s) => s.isAuthenticated)
  const loadUser      = useAuth((s) => s.loadUser)
  const updateProfil  = useAuth((s) => s.updateProfil)
  const isLoading     = useAuth((s) => s.isLoading)

  // ── Formulaire (champs éditables) ────────────────────────────────
  const [firstName,    setFirstName]    = useState('')
  const [lastName,     setLastName]     = useState('')
  const [email,        setEmail]        = useState('')
  const [organisation, setOrganisation] = useState('')
  const [telephone,    setTelephone]    = useState('')
  const [numeroOrdre,  setNumeroOrdre]  = useState('')
  const [region,       setRegion]       = useState('')

  // ── Photo de profil ───────────────────────────────────────────────
  const fileInputRef              = useRef<HTMLInputElement>(null)
  const [photoPreview, setPhotoPreview]   = useState<string | null>(null)   // blob URL de prévisualisation locale
  const [photoUploading, setPhotoUploading] = useState(false)

  // ── Toast inline ─────────────────────────────────────────────────
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'danger' } | null>(null)

  // ── Init ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isAuth) { router.replace(ROUTES.LOGIN); return }
    if (!user) { loadUser() }
  }, [isAuth, user, loadUser, router])

  // Synchroniser le formulaire quand le profil est chargé
  useEffect(() => {
    if (!user) return
    setFirstName(user.first_name   ?? '')
    setLastName(user.last_name     ?? '')
    setEmail(user.email            ?? '')
    setOrganisation(user.organisation ?? '')
    setTelephone(user.telephone    ?? '')
    setNumeroOrdre(user.numero_ordre ?? '')
    setRegion(String(user.region_principale ?? ''))
  }, [user])

  // ── Soumission ────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setToast(null)
    try {
      await updateProfil({
        first_name:        firstName.trim(),
        last_name:         lastName.trim(),
        email:             email.trim(),
        organisation:      organisation.trim(),
        telephone:         telephone.trim(),
        numero_ordre:      numeroOrdre.trim(),
        region_principale: region ? Number(region) : null,
      })
      setToast({ msg: t('profil.toast.succes'), type: 'success' })
    } catch {
      setToast({ msg: t('profil.toast.erreur'), type: 'danger' })
    }
  }

  // ── Photo handlers ────────────────────────────────────────────────

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validation locale
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setToast({ msg: t('profil.photo.format_invalide'), type: 'danger' })
      return
    }
    if (file.size > MAX_PHOTO_SIZE) {
      setToast({ msg: t('profil.photo.trop_lourd'), type: 'danger' })
      return
    }

    // Prévisualisation immédiate (blob URL local, sans attendre le serveur)
    const blobUrl = URL.createObjectURL(file)
    setPhotoPreview(blobUrl)

    // Upload vers le backend
    setPhotoUploading(true)
    setToast(null)
    try {
      const updated = await profilApi.uploadPhoto(file)
      // Mettre à jour le store Auth avec les nouvelles données
      await loadUser()
      // Remplacer le blob URL par l'URL serveur définitive
      setPhotoPreview(updated.photo_url ?? null)
      setToast({ msg: t('profil.photo.succes'), type: 'success' })
    } catch {
      setPhotoPreview(null)
      setToast({ msg: t('profil.photo.erreur'), type: 'danger' })
    } finally {
      setPhotoUploading(false)
      // Réinitialiser l'input pour permettre de re-sélectionner le même fichier
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handlePhotoDelete = async () => {
    setPhotoUploading(true)
    setToast(null)
    try {
      await profilApi.deletePhoto()
      await loadUser()
      setPhotoPreview(null)
      setToast({ msg: t('profil.photo.supp_succes'), type: 'success' })
    } catch {
      setToast({ msg: t('profil.photo.erreur'), type: 'danger' })
    } finally {
      setPhotoUploading(false)
    }
  }

  // ── Style helpers ─────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 11px',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--bg-app)',
    color: 'var(--fg-1)',
    fontSize: 13, outline: 'none',
    fontFamily: 'inherit',
    transition: 'border-color 0.15s',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 600,
    color: 'var(--fg-2)', marginBottom: 5,
  }

  // ── Rendu loading ─────────────────────────────────────────────────
  if (!user) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-app)' }}>
        <Icon name="loader" size={24} color="var(--fg-4)" style={{ animation: 'spin 0.8s linear infinite' }} />
      </div>
    )
  }

  const displayName    = user.nom_complet || `${user.first_name} ${user.last_name}`.trim() || user.username
  const avatar         = initials(displayName)
  // Source de la photo : prévisualisation locale > photo serveur > null (→ initiales)
  const currentPhotoSrc = photoPreview ?? user.photo_url ?? null

  // ── Rendu principal ────────────────────────────────────────────────
  return (
    <div className="page-scrollable" style={{ minHeight: '100vh', background: 'var(--bg-app)', overflowY: 'auto' }}>

      {/* ── Barre de navigation ─────────────────────────────────── */}
      <header className="profil-nav" style={{
        height: 56, background: 'var(--bg-elevated)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center',
        padding: '0 24px', gap: 12,
        position: 'sticky', top: 0, zIndex: 100,
      }}>
        {/* Logo / marque */}
        <Link href={ROUTES.MAP} style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', flexShrink: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/logo/rgnc-webmap-wordmark.svg" alt="RGNC WebMap" style={{ height: 28, width: 'auto' }} />
        </Link>

        <div style={{ width: 1, height: 24, background: 'var(--border-subtle)' }} />

        {/* Fil d'Ariane */}
        <nav className="profil-nav-breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--fg-3)' }}>
          <Link href={ROUTES.MAP} style={{ color: 'var(--fg-3)', textDecoration: 'none' }}>
            {t('header.carte')}
          </Link>
          <Icon name="chevron-right" size={13} />
          <span style={{ color: 'var(--fg-1)', fontWeight: 500 }}>{t('profil.titre')}</span>
        </nav>

        <div style={{ flex: 1 }} />

        {/* Retour */}
        <Button variant="ghost" size="sm" onClick={() => router.push(ROUTES.MAP)}>
          <Icon name="arrow-left" size={13} />
          {t('profil.retour')}
        </Button>
      </header>

      {/* ── Contenu ─────────────────────────────────────────────── */}
      <main className="profil-main" style={{ maxWidth: 900, margin: '0 auto', padding: '32px 24px 64px' }}>

        {/* Titre de page */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--fg-1)', fontFamily: 'var(--font-display)' }}>
            {t('profil.titre')}
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--fg-3)' }}>
            {t('profil.sous_titre')}
          </p>
        </div>

        <div className="profil-grid" style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, alignItems: 'start' }}>

          {/* ── Colonne gauche : avatar + infos compte ───────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Carte avatar */}
            <div style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '24px 20px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
              textAlign: 'center',
            }}>
              {/* ── Avatar cliquable ── */}
              {/* Input fichier caché */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                style={{ display: 'none' }}
                onChange={handlePhotoSelect}
              />

              {/* Cercle avatar — clic = ouvre le sélecteur de fichier */}
              <div
                className="avatar-trigger"
                onClick={() => !photoUploading && fileInputRef.current?.click()}
                title={currentPhotoSrc ? t('profil.photo.changer') : t('profil.photo.ajouter')}
              >
                {/* Photo ou initiales */}
                <div style={{
                  width: 80, height: 80, borderRadius: '50%',
                  overflow: 'hidden',
                  background: 'var(--rgnc-foret-700)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 28, fontWeight: 700, color: '#fff',
                  letterSpacing: '0.02em',
                  fontFamily: 'var(--font-display)',
                  border: '3px solid var(--bg-elevated)',
                  boxShadow: '0 0 0 2px var(--border-subtle)',
                  transition: 'opacity 0.15s',
                  opacity: photoUploading ? 0.6 : 1,
                }}>
                  {currentPhotoSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={currentPhotoSrc}
                      alt={displayName}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : avatar}
                </div>

                {/* Overlay appareil photo au survol */}
                <div className="avatar-camera-overlay">
                  {photoUploading
                    ? <Icon name="loader" size={16} style={{ animation: 'spin 0.8s linear infinite' }} />
                    : <Icon name="camera" size={16} />
                  }
                </div>
              </div>

              <div>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--fg-1)' }}>{displayName}</div>
                <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 2 }}>@{user.username}</div>
              </div>

              {/* Bouton changer / supprimer photo */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
                <button
                  type="button"
                  disabled={photoUploading}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    width: '100%', padding: '6px 10px',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-app)',
                    color: 'var(--fg-2)', fontSize: 12, fontWeight: 500,
                    cursor: photoUploading ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    fontFamily: 'inherit', opacity: photoUploading ? 0.6 : 1,
                    transition: 'background 0.15s',
                  }}
                >
                  <Icon name="camera" size={12} />
                  {currentPhotoSrc ? t('profil.photo.changer') : t('profil.photo.ajouter')}
                </button>

                {currentPhotoSrc && (
                  <button
                    type="button"
                    disabled={photoUploading}
                    onClick={handlePhotoDelete}
                    style={{
                      width: '100%', padding: '5px 10px',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      background: 'none',
                      color: 'var(--rgnc-danger)', fontSize: 11,
                      cursor: photoUploading ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                      fontFamily: 'inherit', opacity: photoUploading ? 0.6 : 1,
                    }}
                  >
                    <Icon name="trash-2" size={11} />
                    {t('profil.photo.supprimer')}
                  </button>
                )}

                <p style={{ margin: 0, fontSize: 10, color: 'var(--fg-4)', lineHeight: 1.4 }}>
                  {t('profil.photo.formats')}
                </p>
              </div>

              {/* Badge rôle */}
              <span style={{
                display: 'inline-block', padding: '3px 10px',
                background: 'var(--rgnc-foret-50)',
                color: 'var(--rgnc-foret-700)',
                border: '1px solid var(--rgnc-foret-200)',
                borderRadius: 'var(--radius-pill)',
                fontSize: 11, fontWeight: 600,
              }}>
                {user.role_label}
              </span>
            </div>

            {/* Carte statut compte */}
            <div style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '16px 20px',
              display: 'flex', flexDirection: 'column', gap: 12,
            }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {t('profil.section.compte')}
              </p>

              {/* Vérification */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--fg-2)' }}>{t('profil.field.role')}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-1)' }}>{user.role_label}</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--fg-2)' }}>Vérification</span>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '2px 8px', borderRadius: 'var(--radius-pill)',
                  fontSize: 11, fontWeight: 600,
                  background: user.est_verifie ? 'var(--rgnc-success-bg)' : 'var(--rgnc-warning-bg)',
                  color:      user.est_verifie ? 'var(--rgnc-success)'    : 'var(--rgnc-warning)',
                }}>
                  <Icon name={user.est_verifie ? 'check' : 'clock'} size={10} />
                  {user.est_verifie ? t('profil.badge.verifie') : t('profil.badge.en_attente')}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--fg-2)' }}>PDF</span>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '2px 8px', borderRadius: 'var(--radius-pill)',
                  fontSize: 11, fontWeight: 600,
                  background: user.peut_telecharger ? 'var(--rgnc-success-bg)' : 'var(--rgnc-encre-50)',
                  color:      user.peut_telecharger ? 'var(--rgnc-success)'    : 'var(--fg-3)',
                }}>
                  <Icon name={user.peut_telecharger ? 'check' : 'lock'} size={10} />
                  {user.peut_telecharger ? t('profil.badge.pdf_ok') : t('profil.badge.pdf_non')}
                </span>
              </div>

              <div style={{ height: 1, background: 'var(--border-subtle)' }} />

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>{t('profil.field.inscription')}</span>
                <span style={{ fontSize: 12, color: 'var(--fg-2)', fontWeight: 500 }}>
                  {format(new Date(user.date_inscription), 'dd MMM yyyy', { locale: dateLocale })}
                </span>
              </div>
            </div>
          </div>

          {/* ── Colonne droite : formulaire ───────────────────────── */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Toast inline */}
            {toast && (
              <InlineToast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />
            )}

            {/* ─ Section identité ─ */}
            <section style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '20px 22px',
            }}>
              <h2 style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 600, color: 'var(--fg-2)', display: 'flex', alignItems: 'center', gap: 7 }}>
                <Icon name="user" size={14} />
                {t('profil.section.identite')}
              </h2>

              <div className="profil-fields-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div>
                  <label htmlFor="p-prenom" style={labelStyle}>{t('profil.field.prenom')}</label>
                  <input
                    id="p-prenom"
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    style={inputStyle}
                    autoComplete="given-name"
                  />
                </div>
                <div>
                  <label htmlFor="p-nom" style={labelStyle}>{t('profil.field.nom_fam')}</label>
                  <input
                    id="p-nom"
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    style={inputStyle}
                    autoComplete="family-name"
                  />
                </div>
              </div>

              <div style={{ marginTop: 14 }}>
                <FieldRO label={t('profil.field.username')} value={
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>@{user.username}</span>
                } />
                <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--fg-4)' }}>
                  {t('profil.readonly_hint')}
                </p>
              </div>
            </section>

            {/* ─ Section contact & organisation ─ */}
            <section style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              padding: '20px 22px',
            }}>
              <h2 style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 600, color: 'var(--fg-2)', display: 'flex', alignItems: 'center', gap: 7 }}>
                <Icon name="building" size={14} />
                {t('profil.section.contact')}
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label htmlFor="p-email" style={labelStyle}>{t('profil.field.email')}</label>
                  <input
                    id="p-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={inputStyle}
                    autoComplete="email"
                  />
                </div>

                <div className="profil-fields-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label htmlFor="p-org" style={labelStyle}>{t('profil.field.organisation')}</label>
                    <input
                      id="p-org"
                      type="text"
                      value={organisation}
                      onChange={(e) => setOrganisation(e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label htmlFor="p-tel" style={labelStyle}>{t('profil.field.telephone')}</label>
                    <input
                      id="p-tel"
                      type="tel"
                      value={telephone}
                      onChange={(e) => setTelephone(e.target.value)}
                      style={inputStyle}
                      placeholder="+237 6XX XXX XXX"
                      autoComplete="tel"
                    />
                  </div>
                </div>

                <div className="profil-fields-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div>
                    <label htmlFor="p-ordre" style={labelStyle}>{t('profil.field.numero_ordre')}</label>
                    <input
                      id="p-ordre"
                      type="text"
                      value={numeroOrdre}
                      onChange={(e) => setNumeroOrdre(e.target.value)}
                      style={inputStyle}
                      placeholder="OG/CM-XXXX"
                    />
                  </div>
                  <div>
                    <label htmlFor="p-region" style={labelStyle}>{t('profil.field.region')}</label>
                    <select
                      id="p-region"
                      value={region}
                      onChange={(e) => setRegion(e.target.value)}
                      style={{ ...inputStyle, color: region ? 'var(--fg-1)' : 'var(--fg-4)' }}
                    >
                      <option value="">{t('profil.field.region_ph')}</option>
                      {REGIONS_CM.map((r) => (
                        <option key={r.code} value={r.code}>{r.nom}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </section>

            {/* ─ Bouton sauvegarder ─ */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                type="submit"
                variant="primary"
                loading={isLoading}
                disabled={isLoading}
              >
                <Icon name="save" size={14} />
                {isLoading ? t('profil.btn.sauvegarder_cours') : t('profil.btn.sauvegarder')}
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
