'use client'

import React, { useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { useLanguage } from '@/hooks/useLanguage'
import { useDemandes, useApproveDemande, useRejectDemande } from '@/hooks/useAdmin'
import { Spinner, ApiError } from './AdminUI'
import type { ToastType } from './adminUtils'

// ── CredentialsModal ──────────────────────────────────────────────────────────

function CredentialsModal({
  nom, email, username, password, onClose,
}: {
  nom: string; email: string; username: string; password: string; onClose: () => void
}) {
  const copied = React.useRef(false)
  const copyAll = () => {
    navigator.clipboard.writeText(`Identifiant : ${username}\nMot de passe temporaire : ${password}`)
    copied.current = true
  }
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(14,27,34,0.55)' }} />
      <div style={{ position: 'relative', width: 420, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon name="user-check" size={18} color="var(--rgnc-success)" />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600 }}>Compte créé — {nom}</span>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
            <Icon name="x" size={14} color="var(--fg-3)" />
          </button>
        </div>

        {/* Avertissement */}
        <div style={{ background: '#FEF9EC', border: '1px solid #E0BE5C', borderRadius: 'var(--radius-sm)', padding: '10px 12px', fontSize: 12, color: '#5C4708', display: 'flex', gap: 8 }}>
          <Icon name="triangle-alert" size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>Ces identifiants sont affichés <strong>une seule fois</strong>. Communiquez-les à {nom} ({email}) par un canal sécurisé.</span>
        </div>

        {/* Champs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--fg-3)', marginBottom: 4 }}>IDENTIFIANT (username)</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, background: 'var(--bg-app)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', color: 'var(--fg-1)', letterSpacing: '0.02em' }}>
              {username}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--fg-3)', marginBottom: 4 }}>MOT DE PASSE TEMPORAIRE</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, background: 'var(--bg-app)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '8px 12px', color: 'var(--rgnc-foret-700)', letterSpacing: '0.08em', fontWeight: 600 }}>
              {password}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button className="btn btn-ghost btn-sm" onClick={copyAll}>
            <Icon name="copy" size={13} /> Copier les deux
          </button>
          <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={onClose}>
            Compris
          </button>
        </div>
      </div>
    </div>
  )
}

// ── SectionRequests ───────────────────────────────────────────────────────────

export function SectionRequests({ onToast }: { onToast: (m: string, t?: ToastType) => void }) {
  const { t } = useLanguage()
  const { data, isLoading, error } = useDemandes({ statut: 'attente' })
  const approveMut = useApproveDemande()
  const rejectMut  = useRejectDemande()
  const [expanded, setExpanded] = useState<number | null>(null)
  const [credentials, setCredentials] = useState<{
    nom: string; email: string; username: string; password: string
  } | null>(null)

  const demandes = data?.results ?? []

  const approve = async (id: number, nom: string, email: string) => {
    try {
      const result = await approveMut.mutateAsync(id) as any
      onToast(`${nom} — ${t('admin.requests.approuver')}.`, 'success')
      // Si un nouveau compte a été créé, afficher les credentials
      if (result?.nouveau_compte && result?.username && result?.temp_password) {
        setCredentials({ nom, email, username: result.username, password: result.temp_password })
      }
    } catch (e: any) {
      onToast(e?.response?.data?.detail || t('admin.requests.erreur'), 'danger')
    }
  }
  const reject = async (id: number, nom: string) => {
    try {
      await rejectMut.mutateAsync(id)
      onToast(`${nom} — ${t('admin.requests.rejeter')}.`, 'warning')
    } catch (e: any) {
      onToast(e?.response?.data?.detail || t('admin.requests.erreur'), 'danger')
    }
  }

  if (isLoading) return <Spinner />
  if (error)     return <ApiError error={error} label={t('admin.requests.erreur')} />

  return (
    <>
      {/* Modal credentials nouveau compte */}
      {credentials && (
        <CredentialsModal
          nom={credentials.nom}
          email={credentials.email}
          username={credentials.username}
          password={credentials.password}
          onClose={() => setCredentials(null)}
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, margin: 0 }}>{t('admin.requests.titre')}</h2>
          {demandes.length > 0 && (
            <span style={{ background: 'var(--rgnc-laterite-500)', color: '#fff', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--radius-pill)' }}>
              {demandes.length}
            </span>
          )}
        </div>

        {demandes.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--fg-3)' }}>
            <Icon name="check" size={28} color="var(--rgnc-success)" style={{ margin: '0 auto 10px', display: 'block' }} />
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--fg-2)' }}>{t('admin.requests.aucune')}</div>
          </div>
        )}

        {demandes.map((r) => (
          <div key={r.id} className="admin-card">
            <div style={{ padding: '14px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg-1)' }}>{r.nom_complet}</span>
                    <span className="badge badge-warning"><span className="badge-dot" />{t('admin.requests.en_attente')}</span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--fg-2)', marginTop: 3 }}>{r.fonction} · {r.organisation} · {r.region_nom}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>{r.email} · {new Date(r.date_demande).toLocaleDateString()}</div>
                </div>
                <button className="btn btn-ghost btn-sm" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                  <Icon name={expanded === r.id ? 'chevron-down' : 'chevron-right'} size={13} />{t('admin.requests.justification')}
                </button>
              </div>
              {expanded === r.id && (
                <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--bg-app)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', fontSize: 13, color: 'var(--fg-2)', lineHeight: 1.6 }}>
                  {r.justification}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--rgnc-danger)' }}
                  onClick={() => reject(r.id, r.nom_complet)}
                  disabled={rejectMut.isPending || approveMut.isPending}>
                  <Icon name="x" size={13} />{t('admin.requests.rejeter')}
                </button>
                <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }}
                  onClick={() => approve(r.id, r.nom_complet, r.email)}
                  disabled={approveMut.isPending || rejectMut.isPending}>
                  <Icon name="check" size={13} />{t('admin.requests.approuver')}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
