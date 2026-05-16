'use client'

import React from 'react'
import { OrdreIcon } from '@/components/ui/OrdreIcon'
import { useLanguage } from '@/hooks/useLanguage'
import { useStatsRGNC } from '@/hooks/useGeodeticPoints'
import { useSignalements } from '@/hooks/useAdmin'
import { Spinner } from './AdminUI'
import { BarChartSVG } from './AdminUI'
import type { AdminSection, ToastType } from './adminUtils'

export function SectionDashboard({ onGoTo, onToast }: { onGoTo: (s: AdminSection) => void; onToast: (m: string, t?: ToastType) => void }) {
  const { t } = useLanguage()
  const { data: stats, isLoading: stLoading, error: stError } = useStatsRGNC()
  const { data: sigsData, isLoading: sigLoading } = useSignalements({ page: 1 })

  const kpiCards = [
    { lbl: t('admin.dash.kpi.total'),     val: stats?.total_points ?? '—',        col: 'var(--rgnc-foret-700)' },
    { lbl: t('admin.dash.kpi.actives'),   val: stats?.par_statut?.find((s) => s.statut === 'actif')?.nb ?? '—',    col: 'var(--rgnc-success)' },
    { lbl: t('admin.dash.kpi.degradees'), val: ((stats?.par_statut?.find((s) => s.statut === 'degrade')?.nb ?? 0) + (stats?.par_statut?.find((s) => s.statut === 'detruit')?.nb ?? 0)) || '—', col: 'var(--rgnc-danger)' },
    { lbl: t('admin.dash.kpi.dl'),        val: stats?.nb_telechargements ?? '—',   col: 'var(--rgnc-info)' },
  ]
  // Lookup { code → [{ ordre, nb }, …] } pour le détail par ordre dans le tooltip
  const ordreByRegion: Record<string, { ordre: number; nb: number }[]> = {}
  for (const entry of stats?.par_region_ordre ?? []) {
    const key = entry.region__code ?? '__null__'
    if (!ordreByRegion[key]) ordreByRegion[key] = []
    ordreByRegion[key].push({ ordre: Number(entry.ordre), nb: entry.nb })
  }

  const regionData = (stats?.par_region ?? [])
    .filter((r) => r.region__code != null || r.region__nom != null)
    .map((r) => ({
      n:       r.region__code ? String(r.region__code) : (r.region__nom?.slice(0, 3).toUpperCase() ?? '?'),
      v:       r.nb,
      tooltip: r.region__nom ?? undefined,
      orders:  ordreByRegion[r.region__code ?? '__null__'] ?? [],
    }))
  const sigs = sigsData?.results ?? []
  const sigEnAttente = sigs.filter((s) => s.statut_traitement === 'attente')

  return (
    <div>
      {/* KPIs */}
      <div className="admin-stat-grid">
        {kpiCards.map((k) => (
          <div key={k.lbl} className="admin-stat-card" style={{ borderTop: `3px solid ${k.col}` }}>
            <div className="asc-label">{k.lbl}</div>
            <div className="asc-value" style={{ color: k.col }}>
              {stLoading ? '…' : typeof k.val === 'number' ? k.val.toLocaleString() : k.val}
            </div>
            {stError && <div style={{ fontSize: 11, color: 'var(--rgnc-danger)' }}>{t('admin.dash.erreur_serveur')}</div>}
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="admin-charts-grid" style={{ display: 'grid', gap: 16, marginBottom: 20 }}>
        <div className="admin-card">
          <div className="admin-card-head"><h3>{t('admin.dash.chart.regions')}</h3></div>
          <div style={{ padding: '12px 14px', overflow: 'visible' }}>
            {stLoading ? <Spinner /> : regionData.length ? <BarChartSVG data={regionData} /> : <p style={{ textAlign: 'center', color: 'var(--fg-3)', fontSize: 13 }}>—</p>}
          </div>
        </div>
        <div className="admin-card">
          <div className="admin-card-head"><h3>{t('admin.dash.chart.ordres')}</h3></div>
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table" style={{ minWidth: 320 }}>
              <thead>
                <tr>
                  <th>{t('admin.dash.chart.ordre_col')}</th>
                  <th>{t('admin.dash.chart.libelle')}</th>
                  <th>{t('admin.dash.chart.bornes')}</th>
                </tr>
              </thead>
              <tbody>
                {stLoading
                  ? <tr><td colSpan={3}><Spinner /></td></tr>
                  : (stats?.par_ordre ?? []).map((o) => (
                    <tr key={o.ordre}>
                      <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><OrdreIcon ordre={o.ordre} size={13} />{o.ordre}</span></td>
                      <td style={{ color: 'var(--fg-2)' }}>{t(`admin.ordre.${o.ordre}` as any)}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{o.nb.toLocaleString()}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Signalements récents */}
      <div className="admin-card">
        <div className="admin-card-head">
          <h3>{t('admin.dash.sig.recents')}</h3>
          {sigEnAttente.length > 0 && (
            <span style={{ background: 'var(--rgnc-warning-bg)', color: '#92700A', padding: '1px 8px', borderRadius: 'var(--radius-pill)', fontSize: 11, fontWeight: 500 }}>
              {sigEnAttente.length} {t('admin.dash.sig.en_attente')}
            </span>
          )}
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto', fontSize: 11 }} onClick={() => onGoTo('signalements')}>
            {t('admin.dash.sig.voir_tout')}
          </button>
        </div>
        {sigLoading ? <Spinner /> : sigs.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--fg-3)', fontSize: 13 }}>{t('admin.dash.sig.aucun')}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table" style={{ minWidth: 480 }}>
              <thead>
                <tr>
                  <th>{t('admin.dash.col.id')}</th>
                  <th>{t('admin.dash.col.borne')}</th>
                  <th>{t('admin.dash.col.type')}</th>
                  <th>{t('admin.dash.col.date')}</th>
                  <th>{t('admin.dash.col.statut')}</th>
                </tr>
              </thead>
              <tbody>
                {sigs.slice(0, 8).map((s) => (
                  <tr key={s.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 10.5, color: 'var(--fg-3)' }}>#{s.id}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>P-{s.point}</td>
                    <td>{s.type_label || s.type_signalement}</td>
                    <td style={{ color: 'var(--fg-3)' }}>{new Date(s.date_signalement).toLocaleDateString()}</td>
                    <td><span className={`badge ${s.statut_traitement === 'resolu' ? 'badge-success' : s.statut_traitement === 'attente' ? 'badge-warning' : 'badge-info'}`}><span className="badge-dot" />{s.statut_traitement_label || s.statut_traitement}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
