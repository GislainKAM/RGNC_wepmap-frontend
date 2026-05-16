'use client'

import React from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import { useSignalements, useUpdateSignalement } from '@/hooks/useAdmin'
import type { Signalement } from '@/lib/types'
import { Spinner, ApiError } from './AdminUI'
import type { ToastType } from './adminUtils'

// ── Types locaux ──────────────────────────────────────────────────────────────

type SigStatus = 'attente' | 'en_verification' | 'resolu' | 'rejete'

// ── MiniMapSig ────────────────────────────────────────────────────────────────

function MiniMapSig({ ok }: { ok: boolean }) {
  const c = ok ? '#1F5D3A' : '#B83434'
  return (
    <svg width="68" height="52" viewBox="0 0 68 52" style={{ display: 'block', flexShrink: 0 }}>
      <rect width="68" height="52" fill="#EDE8DC" />
      <line x1="0" y1="26" x2="68" y2="26" stroke="#CFC5B0" strokeWidth="3" />
      <line x1="34" y1="0" x2="34" y2="52" stroke="#CFC5B0" strokeWidth="3" />
      <circle cx="34" cy="26" r="9" fill={c} opacity="0.18" />
      <circle cx="34" cy="26" r="5" fill={c} stroke="#fff" strokeWidth="1.5" />
    </svg>
  )
}

// ── SigCard ───────────────────────────────────────────────────────────────────

function SigCard({ sig, onMove, onToast }: { sig: Signalement; onMove: (id: number, s: SigStatus) => void; onToast: (m: string, t?: ToastType) => void }) {
  const { t } = useLanguage()
  const ok = sig.statut_traitement === 'resolu'
  return (
    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', marginBottom: 8 }}>
      <div style={{ display: 'flex' }}>
        <MiniMapSig ok={ok} />
        <div style={{ flex: 1, padding: '9px 11px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 4, marginBottom: 2 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-3)' }}>#{sig.id}</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-4)' }}>P-{sig.point}</span>
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-1)', marginBottom: 2 }}>{sig.type_label || sig.type_signalement}</div>
          <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>{sig.reporter_nom} · {new Date(sig.date_signalement).toLocaleDateString()}</div>
        </div>
      </div>
      <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '7px 10px', display: 'flex', gap: 6, background: 'var(--bg-surface)' }}>
        {sig.statut_traitement === 'attente' && (
          <>
            <button className="btn btn-ghost btn-sm" style={{ flex: 1, justifyContent: 'center', fontSize: 11 }}
              onClick={() => onMove(sig.id, 'en_verification')}>{t('admin.sig.prendre_charge')}</button>
            <button className="btn btn-ghost btn-sm" style={{ color: 'var(--rgnc-danger)', fontSize: 11 }}
              onClick={() => onMove(sig.id, 'rejete')}>{t('admin.sig.rejeter')}</button>
          </>
        )}
        {sig.statut_traitement === 'en_verification' && (
          <button className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center', fontSize: 11 }}
            onClick={() => onMove(sig.id, 'resolu')}>{t('admin.sig.marquer_resolu')}</button>
        )}
        {(sig.statut_traitement === 'resolu' || sig.statut_traitement === 'rejete') && (
          <span style={{ fontSize: 11, color: 'var(--fg-3)', lineHeight: 1 }}>{t('admin.sig.traite')}</span>
        )}
      </div>
    </div>
  )
}

// ── SectionSignalements ───────────────────────────────────────────────────────

export function SectionSignalements({ onToast }: { onToast: (m: string, t?: ToastType) => void }) {
  const { t } = useLanguage()
  const { data, isLoading, error } = useSignalements()
  const updateMut = useUpdateSignalement()
  const sigs: Signalement[] = data?.results ?? []

  const SIG_COLS: { id: SigStatus; label: string; color: string }[] = [
    { id: 'attente',         label: t('admin.sig.col.attente'),      color: 'var(--rgnc-warning)' },
    { id: 'en_verification', label: t('admin.sig.col.verification'), color: 'var(--rgnc-info)' },
    { id: 'resolu',          label: t('admin.sig.col.resolu'),       color: 'var(--rgnc-success)' },
    { id: 'rejete',          label: t('admin.sig.col.rejete'),       color: 'var(--rgnc-danger)' },
  ]

  const move = async (id: number, newStatus: SigStatus) => {
    try {
      await updateMut.mutateAsync({ id, data: { statut_traitement: newStatus } })
      onToast(`#${id} — ${t('admin.toast.statut_maj')}.`, 'success')
    } catch (e: any) {
      onToast(e?.response?.data?.detail || t('admin.sig.erreur'), 'danger')
    }
  }

  if (error) return <ApiError error={error} label={t('admin.sig.erreur')} />

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, margin: 0 }}>{t('admin.title.signalements')}</h2>
        <span style={{ background: 'var(--rgnc-laterite-200)', color: 'var(--rgnc-laterite-700)', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--radius-pill)' }}>
          {isLoading ? '…' : `${sigs.filter((s) => s.statut_traitement === 'attente').length} ${t('admin.sig.en_attente')}`}
        </span>
        <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>{data?.count ?? 0} {t('admin.sig.au_total')}</span>
      </div>

      {isLoading ? <Spinner /> : (
        <div className="admin-kanban-wrap" style={{ overflowX: 'auto', paddingBottom: 8 }}>
        <div className="admin-kanban" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, alignItems: 'start', minWidth: 720 }}>
          {SIG_COLS.map((col) => {
            const cards = sigs.filter((s) => s.statut_traitement === col.id)
            return (
              <div key={col.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10, padding: '6px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', borderTop: `3px solid ${col.color}` }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-1)' }}>{col.label}</span>
                  <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: 'var(--fg-3)', background: 'var(--bg-sunken)', padding: '1px 7px', borderRadius: 'var(--radius-pill)' }}>{cards.length}</span>
                </div>
                {cards.map((s) => <SigCard key={s.id} sig={s} onMove={move} onToast={onToast} />)}
                {cards.length === 0 && <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--fg-4)', fontSize: 12 }}>{t('admin.sig.aucun')}</div>}
              </div>
            )
          })}
        </div>
        </div>
      )}
    </div>
  )
}
