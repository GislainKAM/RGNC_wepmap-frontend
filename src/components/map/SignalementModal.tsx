'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Icon } from '@/components/ui/Icon'
import { Button } from '@/components/ui/Button'
import { useSignalerBorne } from '@/hooks/useGeodeticPoints'
import { useLanguage } from '@/hooks/useLanguage'
import type { TranslationKey } from '@/lib/i18n/fr'

// ── Types ────────────────────────────────────────────────────────

interface SignalementModalProps {
  pointId:          number
  pointMatricule?:  string
  onClose:          () => void
  onSuccess:        () => void
}

// ── Constantes — types de problème ───────────────────────────────

const TYPE_KEYS = [
  'borne_detruite',
  'borne_degradee',
  'erreur_coordonnees',
  'acces_bloque',
  'autre',
] as const

type TypeSignalement = typeof TYPE_KEYS[number]

const TYPE_I18N: Record<TypeSignalement, TranslationKey> = {
  borne_detruite:     'signal.type.detruite',
  borne_degradee:     'signal.type.degradee',
  erreur_coordonnees: 'signal.type.erreur_coords',
  acces_bloque:       'signal.type.acces',
  autre:              'signal.type.autre',
}

// ── Composant ────────────────────────────────────────────────────

export function SignalementModal({
  pointId,
  pointMatricule,
  onClose,
  onSuccess,
}: SignalementModalProps) {
  const { t } = useLanguage()

  const [type,        setType]        = useState<TypeSignalement | ''>('')
  const [description, setDescription] = useState('')
  const [photo,       setPhoto]       = useState<File | null>(null)
  const [photoPreview,setPhotoPreview]= useState<string | null>(null)
  const [photoError,  setPhotoError]  = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const mutation     = useSignalerBorne(pointId)

  // Fermeture sur Échap
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [handleKey])

  // Nettoyage de l'URL de prévisualisation au démontage
  useEffect(() => {
    return () => { if (photoPreview) URL.revokeObjectURL(photoPreview) }
  }, [photoPreview])

  // ── Gestion photo ─────────────────────────────────────────────

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError(t('signal.photo.trop_lourd'))
      return
    }
    setPhotoError('')
    setPhoto(file)
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const removePhoto = () => {
    setPhoto(null)
    if (photoPreview) URL.revokeObjectURL(photoPreview)
    setPhotoPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Validation ────────────────────────────────────────────────

  const isValid = type !== '' && description.trim().length >= 20

  // ── Soumission ────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) return
    try {
      await mutation.mutateAsync({
        type_signalement: type as string,
        description:      description.trim(),
        photo,
      })
      onSuccess()
    } catch {
      // l'état d'erreur est géré par mutation.isError
    }
  }

  // ── Rendu ─────────────────────────────────────────────────────

  return (
    /* Backdrop */
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 'var(--z-modal)' as any,
        background: 'rgba(0,0,0,0.52)',
        backdropFilter: 'blur(2px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
        animation: 'fadeIn 0.15s ease',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Carte modale */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="signal-title"
        style={{
          background:   'var(--bg-surface)',
          border:       '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-lg)',
          boxShadow:    'var(--shadow-xl)',
          width: '100%', maxWidth: 480,
          maxHeight: '90vh',
          display: 'flex', flexDirection: 'column',
          animation: 'slideUp 0.18s ease',
        }}
      >
        {/* ── En-tête ─────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 12,
          padding: '18px 20px 14px',
          borderBottom: '1px solid var(--border-subtle)',
        }}>
          {/* Icône */}
          <div style={{
            width: 36, height: 36, borderRadius: 8, flexShrink: 0,
            background: '#FFF8E1',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Icon name="triangle-alert" size={18} color="#D4A017" />
          </div>

          {/* Titre + matricule */}
          <div style={{ flex: 1 }}>
            <div
              id="signal-title"
              style={{ fontWeight: 700, fontSize: 15, color: 'var(--fg-1)' }}
            >
              {t('signal.title')}
            </div>
            {pointMatricule && (
              <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 2 }}>
                #{pointMatricule}
              </div>
            )}
          </div>

          {/* Bouton fermer */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            style={{
              border: 'none', background: 'transparent', cursor: 'pointer',
              padding: 4, color: 'var(--fg-3)', borderRadius: 4,
              display: 'flex', alignItems: 'center',
            }}
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        {/* ── Formulaire ──────────────────────────────────────── */}
        <form
          id="signal-form"
          onSubmit={handleSubmit}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
        >
          {/* Corps scrollable */}
          <div style={{
            flex: 1, overflowY: 'auto',
            padding: '18px 20px',
            display: 'flex', flexDirection: 'column', gap: 16,
          }}>

            {/* ─ Type de problème ─ */}
            <div>
              <label
                htmlFor="signal-type"
                style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--fg-2)', marginBottom: 6 }}
              >
                {t('signal.type.label')}
              </label>
              <select
                id="signal-type"
                value={type}
                onChange={(e) => setType(e.target.value as TypeSignalement)}
                required
                style={{
                  width: '100%', padding: '8px 10px',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-app)',
                  color: type ? 'var(--fg-1)' : 'var(--fg-4)',
                  fontSize: 13, outline: 'none',
                }}
              >
                <option value="" disabled>{t('signal.type.placeholder')}</option>
                {TYPE_KEYS.map((k) => (
                  <option key={k} value={k}>{t(TYPE_I18N[k])}</option>
                ))}
              </select>
            </div>

            {/* ─ Description ─ */}
            <div>
              <label
                htmlFor="signal-desc"
                style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--fg-2)', marginBottom: 6 }}
              >
                {t('signal.desc.label')}
              </label>
              <textarea
                id="signal-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder={t('signal.desc.placeholder')}
                required
                style={{
                  width: '100%', padding: '8px 10px',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-app)',
                  color: 'var(--fg-1)',
                  fontSize: 13, lineHeight: 1.55,
                  resize: 'vertical', minHeight: 90,
                  outline: 'none', boxSizing: 'border-box',
                  fontFamily: 'inherit',
                }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--fg-4)' }}>
                  {t('signal.desc.min')}
                </span>
                <span style={{
                  fontSize: 11,
                  color: description.length >= 20 ? '#1F5D3A' : 'var(--fg-4)',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {description.length} {description.length < 20 ? `/ 20` : '✓'}
                </span>
              </div>
            </div>

            {/* ─ Photo ─ */}
            <div>
              <label
                style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--fg-2)', marginBottom: 6 }}
              >
                {t('signal.photo.label')}
              </label>

              {photoPreview ? (
                /* Prévisualisation */
                <div style={{
                  position: 'relative', borderRadius: 'var(--radius-sm)',
                  overflow: 'hidden', border: '1px solid var(--border-subtle)',
                }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoPreview}
                    alt="Aperçu"
                    style={{ width: '100%', maxHeight: 200, objectFit: 'cover', display: 'block' }}
                  />
                  <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        background: 'rgba(0,0,0,0.62)', border: 'none',
                        color: '#fff', borderRadius: 4, padding: '4px 9px',
                        fontSize: 11, cursor: 'pointer',
                      }}
                    >
                      {t('signal.photo.change')}
                    </button>
                    <button
                      type="button"
                      onClick={removePhoto}
                      style={{
                        background: 'rgba(184,52,52,0.85)', border: 'none',
                        color: '#fff', borderRadius: 4, padding: '4px 9px',
                        fontSize: 11, cursor: 'pointer',
                      }}
                    >
                      {t('signal.photo.remove')}
                    </button>
                  </div>
                </div>
              ) : (
                /* Zone de dépôt */
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    width: '100%', padding: '18px 16px',
                    border: '1.5px dashed var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-app)',
                    cursor: 'pointer',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', gap: 7, color: 'var(--fg-4)',
                    transition: 'border-color 0.15s, color 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--fg-4)'
                    ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--fg-3)'
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-subtle)'
                    ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--fg-4)'
                  }}
                >
                  <Icon name="camera" size={22} />
                  <span style={{ fontSize: 12 }}>{t('signal.photo.hint')}</span>
                </button>
              )}

              {photoError && (
                <div style={{ fontSize: 11, color: '#B83434', marginTop: 4 }}>
                  {photoError}
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handlePhotoChange}
                style={{ display: 'none' }}
              />
            </div>

            {/* ─ Erreur d'envoi ─ */}
            {mutation.isError && (
              <div style={{
                background: '#FEF2F2', border: '1px solid #FECACA',
                borderRadius: 'var(--radius-sm)', padding: '10px 12px',
                fontSize: 12, color: '#B83434',
                display: 'flex', gap: 8, alignItems: 'center',
              }}>
                <Icon name="alert-circle" size={14} />
                {t('signal.error')}
              </div>
            )}
          </div>

          {/* ── Pied de formulaire ───────────────────────────── */}
          <div style={{
            display: 'flex', gap: 8, justifyContent: 'flex-end',
            padding: '12px 20px 16px',
            borderTop: '1px solid var(--border-subtle)',
          }}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={mutation.isPending}
            >
              {t('signal.btn.cancel')}
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={!isValid || mutation.isPending}
              loading={mutation.isPending}
            >
              <Icon name="send" size={13} />
              {t('signal.btn.submit')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
