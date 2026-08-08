'use client'

import React from 'react'
import { useLanguage } from '@/hooks/useLanguage'
import type { StatsRGNC, ZoneInteret } from '@/lib/types'

interface StatsStripProps {
  stats: StatsRGNC | null
  visibleCount: number
  /** Zone observée — son nom remplace les colonnes coupées sur mobile. */
  zone?: ZoneInteret | null
}

function getStatutCount(stats: StatsRGNC | null, statut: string): number {
  if (!stats) return 0
  return stats.par_statut.find((s) => s.statut === statut)?.nb ?? 0
}

export function StatsStrip({ stats, visibleCount, zone }: StatsStripProps) {
  const { t, lang } = useLanguage()

  const total     = stats?.total_points ?? 0
  const conformes = getStatutCount(stats, 'actif')
  const aVerifier = getStatutCount(stats, 'degrade')
  const detruits  = getStatutCount(stats, 'detruit')
  const locale    = lang === 'fr' ? 'fr-FR' : 'en-US'

  return (
    <div className="stats-strip" role="status" aria-label="Statistiques du réseau géodésique">

      {/* ── Version mobile ──
          Les six colonnes ci-dessous totalisaient 616 px de large pour
          375 px d'écran : 39 % du contenu était hors champ, derrière un
          défilement horizontal dont la barre est masquée — donc sans le
          moindre indice qu'il restait quelque chose à voir.
          Cette ligne dit ce qui compte sur le terrain : où l'on regarde,
          combien de bornes s'y trouvent, et leur état. */}
      <div className="stats-mobile">
        <span className="stats-mobile-zone" title={zone?.nom ?? ''}>
          {zone?.nom ?? t('stats.pays')}
        </span>
        <span className="stats-mobile-nb">
          <b>{visibleCount.toLocaleString(locale)}</b>
          <span className="stats-mobile-total">/ {total.toLocaleString(locale)}</span>
        </span>
        <span className="stats-mobile-puces">
          <span className="sp sp-ok"      title={t('stats.conformes')}>{conformes.toLocaleString(locale)}</span>
          <span className="sp sp-warn"    title={t('stats.averifier')}>{aVerifier.toLocaleString(locale)}</span>
          <span className="sp sp-danger"  title={t('stats.detruites')}>{detruits.toLocaleString(locale)}</span>
        </span>
      </div>

      <div className="stat-item">
        <span>{t('stats.affiches')}</span>
        <span className="sv">{visibleCount.toLocaleString(locale)}</span>
        <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>/ {total.toLocaleString(locale)}</span>
      </div>
      <div className="stat-item">
        <span>{t('stats.conformes')}</span>
        <span className="sv success">{conformes.toLocaleString(locale)}</span>
      </div>
      <div className="stat-item">
        <span>{t('stats.averifier')}</span>
        <span className="sv warning">{aVerifier.toLocaleString(locale)}</span>
      </div>
      <div className="stat-item">
        <span>{t('stats.detruites')}</span>
        <span className="sv danger">{detruits.toLocaleString(locale)}</span>
      </div>
      <div className="stat-item">
        <span>{t('stats.zone')}</span>
        <span className="sv" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>32N / 33N</span>
      </div>
      <div className="stat-meta">
        <span>{t('stats.pays')}</span>
        <span style={{ width: 1, height: 10, background: 'rgba(255,255,255,0.15)', display: 'inline-block' }} />
        <span>RGNC</span>
      </div>
    </div>
  )
}
