'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/ui/Icon'
import { OrdreIcon } from '@/components/ui/OrdreIcon'
import { useAuth } from '@/hooks/useAuth'
import { useLanguage } from '@/hooks/useLanguage'
import { useStatsRGNC } from '@/hooks/useGeodeticPoints'
import {
  useAdminBornes, useAdminBorneDetail,
  useCreateBorne, useUpdateBorne, useDeleteBornes,
  useSignalements, useUpdateSignalement,
  useAdminUsers, useUpdateUser, useInviteAgent,
  useDemandes, useApproveDemande, useRejectDemande,
  useImportBornes,
} from '@/hooks/useAdmin'
import { regionApi, departementApi, communeApi, importApi } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'
import { ROUTES } from '@/lib/constants'
import type {
  PointGeodesiqueLight, PointGeodesiqueDetail,
  StatutBorne, OrdreBorne, ReseauBorne,
  Signalement, ProfilUtilisateur, ImportResult,
} from '@/lib/types'

// ── Types ─────────────────────────────────────────────────────────────────────

type AdminSection = 'dashboard' | 'bornes' | 'signalements' | 'import' | 'requests' | 'agents'
type ToastType    = 'success' | 'info' | 'warning' | 'danger'
interface Toast { id: number; msg: string; type: ToastType }

// ── Module-level constants (no translated strings) ────────────────────────────

const STATUT_CLS: Record<StatutBorne, string> = {
  actif:   'badge-success',
  degrade: 'badge-warning',
  detruit: 'badge-danger',
  inconnu: '',
}

const RESEAU_LABELS: Record<ReseauBorne, string> = {
  PAMOCCA: 'PAMOCCA 2011', DENSIF_2018: 'Densification 2018',
  DENSIF_2019: 'Densification 2019', DENSIF_2021: 'Densification 2021',
  DENSIF_2025: 'Densification 2025', AUTRE: 'Autre',
}

const inputSt: React.CSSProperties = {
  height: 34, border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)',
  padding: '0 10px', fontFamily: 'var(--font-body)', fontSize: 13,
  color: 'var(--fg-1)', background: 'var(--bg-sunken)', outline: 'none',
}

// ── Toast system ──────────────────────────────────────────────────────────────

function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const counter = useRef(0)
  const push = (msg: string, type: ToastType = 'info') => {
    const id = ++counter.current
    setToasts((t) => [...t, { id, msg, type }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000)
  }
  return { toasts, push }
}

function ToastStack({ toasts }: { toasts: Toast[] }) {
  const colors: Record<ToastType, string> = {
    success: 'var(--rgnc-success)', info: 'var(--rgnc-info)',
    warning: 'var(--rgnc-warning)', danger: 'var(--rgnc-danger)',
  }
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
      {toasts.map((t) => (
        <div key={t.id} style={{ background: 'var(--bg-elevated)', border: `1px solid ${colors[t.type]}`, borderLeft: `4px solid ${colors[t.type]}`, borderRadius: 'var(--radius-sm)', padding: '10px 16px', fontSize: 13, color: 'var(--fg-1)', boxShadow: 'var(--shadow-md)', maxWidth: 360 }}>
          {t.msg}
        </div>
      ))}
    </div>
  )
}

// ── Helpers UI ────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div style={{ padding: '40px 0', display: 'flex', justifyContent: 'center', color: 'var(--fg-3)' }}>
      <Icon name="loader" size={24} style={{ animation: 'spin 1s linear infinite' }} />
    </div>
  )
}

function ApiError({ error, label }: { error: unknown; label: string }) {
  const { t } = useLanguage()
  const msg = error instanceof Error ? error.message : t('admin.erreur_serveur')
  return (
    <div style={{ padding: '24px 18px', background: 'var(--rgnc-danger-bg)', border: '1px solid var(--rgnc-danger)', borderRadius: 'var(--radius-sm)', color: '#5C1818', fontSize: 13 }}>
      <b>{label}</b> — {msg}
    </div>
  )
}

// ── SVG Charts ────────────────────────────────────────────────────────────────

function BarChartSVG({ data }: { data: { n: string; v: number }[] }) {
  if (!data.length) return null
  const maxV = Math.max(...data.map((d) => d.v), 1)
  const bW = 22, gap = 9, cH = 96, pL = 28, pB = 22, pT = 10
  const svgW = pL + data.length * (bW + gap) - gap + 6
  return (
    <svg viewBox={`0 0 ${svgW} ${cH + pB + 14}`} style={{ width: '100%' }}>
      {[0, Math.round(maxV / 4), Math.round(maxV / 2), Math.round(maxV * 3 / 4), maxV].map((v) => {
        const y = pT + cH - (v / maxV) * cH
        return (
          <g key={v}>
            <line x1={pL} y1={y} x2={svgW - 4} y2={y} stroke="var(--border-subtle)" strokeWidth="1" />
            <text x={pL - 4} y={y + 3.5} textAnchor="end" fontFamily="var(--font-mono)" fontSize="7.5" fill="var(--fg-4)">{v}</text>
          </g>
        )
      })}
      {data.map((r, i) => {
        const bh = Math.max((r.v / maxV) * cH, 2)
        const x = pL + i * (bW + gap)
        const y = pT + cH - bh
        return (
          <g key={r.n}>
            <rect x={x} y={y} width={bW} height={bh} rx="2" fill="var(--rgnc-foret-700)" opacity="0.75" />
            <text x={x + bW / 2} y={y - 4} textAnchor="middle" fontFamily="var(--font-mono)" fontSize="7.5" fill="var(--fg-2)">{r.v}</text>
            <text x={x + bW / 2} y={pT + cH + 14} textAnchor="middle" fontFamily="var(--font-body)" fontSize="8" fill="var(--fg-3)">{r.n.slice(0, 8)}</text>
          </g>
        )
      })}
    </svg>
  )
}

// ── Section : Dashboard ───────────────────────────────────────────────────────

function SectionDashboard({ onGoTo, onToast }: { onGoTo: (s: AdminSection) => void; onToast: (m: string, t?: ToastType) => void }) {
  const { t } = useLanguage()
  const { data: stats, isLoading: stLoading, error: stError } = useStatsRGNC()
  const { data: sigsData, isLoading: sigLoading } = useSignalements({ page: 1 })

  const kpiCards = [
    { lbl: t('admin.dash.kpi.total'),     val: stats?.total_points ?? '—',        col: 'var(--rgnc-foret-700)' },
    { lbl: t('admin.dash.kpi.actives'),   val: stats?.par_statut?.find((s) => s.statut === 'actif')?.nb ?? '—',    col: 'var(--rgnc-success)' },
    { lbl: t('admin.dash.kpi.degradees'), val: ((stats?.par_statut?.find((s) => s.statut === 'degrade')?.nb ?? 0) + (stats?.par_statut?.find((s) => s.statut === 'detruit')?.nb ?? 0)) || '—', col: 'var(--rgnc-danger)' },
    { lbl: t('admin.dash.kpi.dl'),        val: stats?.nb_telechargements ?? '—',   col: 'var(--rgnc-info)' },
  ]
  const regionData = (stats?.par_region ?? []).map((r) => ({ n: r.region__nom ?? '—', v: r.nb }))
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div className="admin-card">
          <div className="admin-card-head"><h3>{t('admin.dash.chart.regions')}</h3></div>
          <div style={{ padding: '12px 14px' }}>
            {stLoading ? <Spinner /> : regionData.length ? <BarChartSVG data={regionData} /> : <p style={{ textAlign: 'center', color: 'var(--fg-3)', fontSize: 13 }}>—</p>}
          </div>
        </div>
        <div className="admin-card">
          <div className="admin-card-head"><h3>{t('admin.dash.chart.ordres')}</h3></div>
          <table className="admin-table">
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
          <table className="admin-table">
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
        )}
      </div>
    </div>
  )
}

// ── Section : Bornes (CRUD réel) ──────────────────────────────────────────────

interface BorneFormData {
  nom: string; matricule: string
  latitude_dd: string; longitude_dd: string; altitude_ngac: string; zone_utm: string
  ordre: OrdreBorne; reseau: ReseauBorne; statut: StatutBorne
  region: string; departement: string; commune: string; localite: string
  description_acces: string; description_borne: string
}

function BorneSlideOver({ editId, onClose, onToast }: {
  editId: number | null
  onClose: () => void
  onToast: (m: string, t?: ToastType) => void
}) {
  const { t } = useLanguage()
  const isNew = editId === null
  const { data: detail, isLoading: detailLoading } = useAdminBorneDetail(editId)
  const createMut  = useCreateBorne()
  const updateMut  = useUpdateBorne()
  const isSaving   = createMut.isPending || updateMut.isPending

  const { data: regions = [] } = useQuery({ queryKey: ['regions'], queryFn: regionApi.list, staleTime: Infinity })
  const [regionId, setRegionId] = useState<number | ''>('')
  const [deptId,   setDeptId]   = useState<number | ''>('')
  const { data: depts = [] } = useQuery({
    queryKey: ['depts', regionId], queryFn: () => departementApi.list(regionId as number),
    enabled: regionId !== '', staleTime: Infinity,
  })
  const { data: communes = [] } = useQuery({
    queryKey: ['communes', deptId], queryFn: () => communeApi.list(deptId as number),
    enabled: deptId !== '', staleTime: Infinity,
  })

  const [form, setForm] = useState<BorneFormData>({
    nom: '', matricule: '', latitude_dd: '', longitude_dd: '', altitude_ngac: '',
    zone_utm: '33N', ordre: 2, reseau: 'PAMOCCA', statut: 'actif',
    region: '', departement: '', commune: '', localite: '',
    description_acces: '', description_borne: '',
  })

  useEffect(() => {
    if (detail) {
      setForm({
        nom:               detail.nom,
        matricule:         detail.matricule,
        latitude_dd:       String(detail.latitude_dd),
        longitude_dd:      String(detail.longitude_dd),
        altitude_ngac:     detail.altitude_ngac != null ? String(detail.altitude_ngac) : '',
        zone_utm:          detail.zone_utm || '33N',
        ordre:             detail.ordre,
        reseau:            detail.reseau,
        statut:            detail.statut,
        region:            detail.region_nom,
        departement:       detail.departement_nom,
        commune:           detail.commune_nom,
        localite:          detail.localite,
        description_acces: detail.description_acces,
        description_borne: detail.description_borne,
      })
    }
  }, [detail])

  const set = <K extends keyof BorneFormData>(k: K, v: BorneFormData[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const handleSave = async () => {
    const payload: Partial<PointGeodesiqueDetail> = {
      nom:               form.nom,
      matricule:         form.matricule || undefined,
      latitude_dd:       parseFloat(form.latitude_dd),
      longitude_dd:      parseFloat(form.longitude_dd),
      altitude_ngac:     form.altitude_ngac ? parseFloat(form.altitude_ngac) : null,
      zone_utm:          form.zone_utm,
      ordre:             form.ordre,
      reseau:            form.reseau,
      statut:            form.statut,
      localite:          form.localite,
      description_acces: form.description_acces,
      description_borne: form.description_borne,
    }
    if (regionId !== '')  (payload as any).region      = regionId
    if (deptId   !== '')  (payload as any).departement = deptId
    if (communes.length && form.commune) {
      const c = communes.find((x) => x.nom === form.commune)
      if (c) (payload as any).commune = c.id
    }
    try {
      if (isNew) {
        await createMut.mutateAsync(payload)
        onToast(`"${form.nom}" ${t('admin.toast.borne_creee')}.`, 'success')
      } else {
        await updateMut.mutateAsync({ id: editId!, data: payload })
        onToast(`"${form.nom}" — ${t('admin.toast.borne_modifiee')}.`, 'success')
      }
      onClose()
    } catch (e: any) {
      onToast(e?.response?.data?.detail || t('admin.borne.err_save'), 'danger')
    }
  }

  const fld: React.CSSProperties = {
    width: '100%', fontFamily: 'var(--font-body)', fontSize: 13, padding: '8px 10px',
    background: 'var(--bg-sunken)', border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-sm)', color: 'var(--fg-1)', outline: 'none',
    height: 34, boxSizing: 'border-box',
  }
  const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--fg-2)', marginBottom: 4 }
  const sec: React.CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--fg-3)', margin: '14px 0 10px', borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 800, display: 'flex' }}>
      <div onClick={onClose} style={{ flex: 1, background: 'rgba(14,27,34,0.45)' }} />
      <div style={{ width: 440, background: 'var(--bg-elevated)', display: 'flex', flexDirection: 'column', height: '100%', boxShadow: 'var(--shadow-lg)' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: 'var(--fg-1)' }}>
              {isNew ? t('admin.borne.nouvelle') : detailLoading ? t('admin.borne.saving') : `${t('admin.borne.modifier')} ${detail?.matricule}`}
            </div>
            {!isNew && detail && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>{detail.matricule}</div>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: 'var(--fg-3)', display: 'flex' }}>
            <Icon name="x" size={16} />
          </button>
        </div>

        {detailLoading && !isNew
          ? <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner /></div>
          : (
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 18px 16px' }}>
            <div style={sec}>{t('admin.borne.s.designation')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label style={lbl}>{t('admin.borne.lbl.nom')}</label>
                <input style={fld} value={form.nom} onChange={(e) => set('nom', e.target.value)} placeholder="ex : Repère Etoa-Meki" />
              </div>
              <div>
                <label style={lbl}>{t('admin.borne.lbl.matricule')}</label>
                <input style={fld} value={form.matricule} onChange={(e) => set('matricule', e.target.value)} placeholder="ex : B441" />
              </div>
            </div>

            <div style={sec}>{t('admin.borne.s.localisation')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label style={lbl}>{t('admin.borne.lbl.region')}</label>
                <select style={{ ...fld }} value={regionId} onChange={(e) => { const v = Number(e.target.value); setRegionId(v || ''); setDeptId('') }}>
                  <option value="">{t('admin.borne.choisir')}</option>
                  {regions.map((r) => <option key={r.id} value={r.id}>{r.nom}</option>)}
                </select>
                {detail?.region_nom && regionId === '' && <span style={{ fontSize: 10, color: 'var(--fg-3)' }}>{t('admin.borne.actuel')} {detail.region_nom}</span>}
              </div>
              <div>
                <label style={lbl}>{t('admin.borne.lbl.dept')}</label>
                <select style={{ ...fld }} value={deptId} onChange={(e) => { const v = Number(e.target.value); setDeptId(v || ''); set('departement', e.target.options[e.target.selectedIndex].text) }} disabled={regionId === ''}>
                  <option value="">{t('admin.borne.choisir')}</option>
                  {depts.map((d) => <option key={d.id} value={d.id}>{d.nom}</option>)}
                </select>
                {detail?.departement_nom && deptId === '' && <span style={{ fontSize: 10, color: 'var(--fg-3)' }}>{t('admin.borne.actuel')} {detail.departement_nom}</span>}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label style={lbl}>{t('admin.borne.lbl.commune')}</label>
                <select style={{ ...fld }} value={form.commune} onChange={(e) => set('commune', e.target.value)} disabled={deptId === ''}>
                  <option value="">{t('admin.borne.choisir')}</option>
                  {communes.map((c) => <option key={c.id} value={c.nom}>{c.nom}</option>)}
                </select>
                {detail?.commune_nom && form.commune === '' && <span style={{ fontSize: 10, color: 'var(--fg-3)' }}>{t('admin.borne.actuel')} {detail.commune_nom}</span>}
              </div>
              <div>
                <label style={lbl}>{t('admin.borne.lbl.localite')}</label>
                <input style={fld} value={form.localite} onChange={(e) => set('localite', e.target.value)} placeholder="ex : Etoa-Meki" />
              </div>
            </div>

            <div style={sec}>{t('admin.borne.s.coords')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label style={lbl}>{t('admin.borne.lbl.lat')}</label>
                <input style={fld} value={form.latitude_dd} onChange={(e) => set('latitude_dd', e.target.value)} placeholder="ex : 3.86306" />
              </div>
              <div>
                <label style={lbl}>{t('admin.borne.lbl.lon')}</label>
                <input style={fld} value={form.longitude_dd} onChange={(e) => set('longitude_dd', e.target.value)} placeholder="ex : 11.52000" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <label style={lbl}>{t('admin.borne.lbl.alt')}</label>
                <input style={fld} value={form.altitude_ngac} onChange={(e) => set('altitude_ngac', e.target.value)} placeholder="ex : 758.421" />
              </div>
              <div>
                <label style={lbl}>{t('admin.borne.lbl.utm')}</label>
                <select style={{ ...fld }} value={form.zone_utm} onChange={(e) => set('zone_utm', e.target.value)}>
                  <option value="32N">32N</option>
                  <option value="33N">33N</option>
                </select>
              </div>
            </div>

            <div style={sec}>{t('admin.borne.s.caract')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label style={lbl}>{t('admin.borne.lbl.ordre')}</label>
                <select style={{ ...fld }} value={form.ordre} onChange={(e) => set('ordre', Number(e.target.value) as OrdreBorne)}>
                  <option value={1}>{t('admin.borne.ordre.1')}</option>
                  <option value={2}>{t('admin.borne.ordre.2')}</option>
                  <option value={3}>{t('admin.borne.ordre.3')}</option>
                </select>
              </div>
              <div>
                <label style={lbl}>{t('admin.borne.lbl.reseau')}</label>
                <select style={{ ...fld }} value={form.reseau} onChange={(e) => set('reseau', e.target.value as ReseauBorne)}>
                  {(Object.entries(RESEAU_LABELS) as [ReseauBorne, string][]).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>{t('admin.borne.lbl.statut')}</label>
              <select style={{ ...fld }} value={form.statut} onChange={(e) => set('statut', e.target.value as StatutBorne)}>
                <option value="actif">{t('admin.statut.actif')}</option>
                <option value="degrade">{t('admin.statut.degrade')}</option>
                <option value="detruit">{t('admin.statut.detruit')}</option>
                <option value="inconnu">{t('admin.statut.inconnu')}</option>
              </select>
            </div>

            <div style={sec}>{t('admin.borne.s.description')}</div>
            <div style={{ marginBottom: 10 }}>
              <label style={lbl}>{t('admin.borne.lbl.acces')}</label>
              <textarea style={{ ...fld, height: 64, resize: 'vertical', lineHeight: 1.5 }} value={form.description_acces} onChange={(e) => set('description_acces', e.target.value)} placeholder="Instructions pour atteindre la borne…" />
            </div>
            <div>
              <label style={lbl}>{t('admin.borne.lbl.description')}</label>
              <textarea style={{ ...fld, height: 64, resize: 'vertical', lineHeight: 1.5 }} value={form.description_borne} onChange={(e) => set('description_borne', e.target.value)} placeholder="État, matériau, marquage…" />
            </div>

            {(createMut.error || updateMut.error) && (
              <div style={{ marginTop: 12 }}>
                <ApiError error={createMut.error || updateMut.error} label={t('admin.borne.err_save')} />
              </div>
            )}
          </div>
        )}

        <div style={{ padding: '11px 18px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 8, flexShrink: 0 }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ flex: 1 }} disabled={isSaving}>{t('admin.borne.annuler')}</button>
          <button className="btn btn-primary btn-sm" style={{ flex: 2 }} onClick={handleSave} disabled={isSaving || !form.nom || !form.latitude_dd || !form.longitude_dd}>
            {isSaving ? t('admin.borne.saving') : isNew ? t('admin.borne.creer') : t('admin.borne.enregistrer')}
          </button>
        </div>
      </div>
    </div>
  )
}

function SectionBornes({ onToast }: { onToast: (m: string, t?: ToastType) => void }) {
  const { t } = useLanguage()
  const [search,    setSearch]    = useState('')
  const [filterSt,  setFilterSt]  = useState<StatutBorne | ''>('')
  const [filterOrd, setFilterOrd] = useState<OrdreBorne | ''>('')
  const [page,      setPage]      = useState(1)
  const [selIds,    setSelIds]    = useState<Set<number>>(new Set())
  const [editId,    setEditId]    = useState<number | null | 'new'>(null)

  const filtres = {
    ...(search    ? { recherche: search }  : {}),
    ...(filterSt  ? { statuts: [filterSt] } : {}),
    ...(filterOrd ? { ordres: [filterOrd] } : {}),
  }
  const { data, isLoading, error } = useAdminBornes(filtres, page)
  const deleteMut = useDeleteBornes()

  const bornes = data?.results ?? []
  const total  = data?.count   ?? 0
  const totalPages = Math.ceil(total / 25) || 1

  const toggleSel = (id: number) => setSelIds((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = () => setSelIds(selIds.size === bornes.length && bornes.length > 0 ? new Set() : new Set(bornes.map((b) => b.id)))

  const handleDelete = async () => {
    if (!confirm(`${t('admin.toast.confirm_supp')} ${selIds.size} ${t('admin.toast.bornes_sel')}`)) return
    try {
      await deleteMut.mutateAsync([...selIds])
      onToast(`${selIds.size} ${t('admin.toast.bornes_supp')}.`, 'success')
      setSelIds(new Set())
    } catch {
      onToast(t('admin.bornes.erreur'), 'danger')
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '0 0 240px' }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}>
            <Icon name="search" size={14} color="var(--fg-3)" />
          </span>
          <input style={{ ...inputSt, width: '100%', paddingLeft: 32 }}
            placeholder={t('admin.bornes.search')} value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <select style={inputSt} value={filterOrd} onChange={(e) => { setFilterOrd(Number(e.target.value) as OrdreBorne || ''); setPage(1) }}>
          <option value="">{t('admin.bornes.tous_ordres')}</option>
          <option value={1}>{t('admin.ordre.1')}</option>
          <option value={2}>{t('admin.ordre.2')}</option>
          <option value={3}>{t('admin.ordre.3')}</option>
        </select>
        <select style={inputSt} value={filterSt} onChange={(e) => { setFilterSt(e.target.value as StatutBorne || ''); setPage(1) }}>
          <option value="">{t('admin.bornes.tous_statuts')}</option>
          <option value="actif">{t('admin.statut.actif')}</option>
          <option value="degrade">{t('admin.statut.degrade')}</option>
          <option value="detruit">{t('admin.statut.detruit')}</option>
          <option value="inconnu">{t('admin.statut.inconnu')}</option>
        </select>
        <span style={{ fontSize: 13, color: 'var(--fg-3)', marginLeft: 4 }}>
          <b style={{ color: 'var(--fg-1)' }}>{isLoading ? '…' : total.toLocaleString()}</b> {t('admin.bornes.bornes')}
        </span>
        <div style={{ flex: 1 }} />
        {selIds.size > 0 && (
          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--rgnc-danger)' }} onClick={handleDelete} disabled={deleteMut.isPending}>
            <Icon name="x" size={13} />{deleteMut.isPending ? t('admin.bornes.suppression') : `${t('admin.bornes.supprimer')} (${selIds.size})`}
          </button>
        )}
        <button className="btn btn-primary btn-sm" onClick={() => setEditId('new')}>
          <Icon name="plus" size={13} />{t('admin.bornes.ajouter')}
        </button>
      </div>

      {error && <div style={{ marginBottom: 12 }}><ApiError error={error} label={t('admin.bornes.erreur')} /></div>}

      <div className="admin-card">
        <div style={{ overflowX: 'auto' }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input type="checkbox" style={{ accentColor: 'var(--rgnc-foret-700)' }}
                    onChange={toggleAll} checked={selIds.size === bornes.length && bornes.length > 0} />
                </th>
                {[
                  t('admin.bornes.col.matricule'), t('admin.bornes.col.nom'),
                  t('admin.bornes.col.region'), t('admin.bornes.col.commune'),
                  t('admin.bornes.col.localite'), t('admin.bornes.col.ordre'),
                  t('admin.bornes.col.statut'), '',
                ].map((h) => <th key={h}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={9}><Spinner /></td></tr>}
              {!isLoading && bornes.map((b: PointGeodesiqueLight) => (
                <tr key={b.id} onClick={() => toggleSel(b.id)} style={{ background: selIds.has(b.id) ? 'var(--rgnc-foret-50)' : '', cursor: 'pointer' }}>
                  <td onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selIds.has(b.id)} readOnly style={{ accentColor: 'var(--rgnc-foret-700)' }} />
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-3)' }}>{b.matricule}</td>
                  <td style={{ fontWeight: 500, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.nom}</td>
                  <td style={{ color: 'var(--fg-2)' }}>{b.region_nom}</td>
                  <td style={{ color: 'var(--fg-2)' }}>{b.commune_nom}</td>
                  <td style={{ color: 'var(--fg-3)', fontStyle: 'italic', fontSize: 12 }}>{b.localite}</td>
                  <td>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <OrdreIcon ordre={b.ordre} size={12} />
                      <span style={{ fontSize: 11, background: 'var(--rgnc-foret-50)', color: 'var(--rgnc-foret-700)', padding: '1px 6px', borderRadius: 'var(--radius-xs)' }}>
                        {t(`admin.ordre.${b.ordre}` as any)}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${STATUT_CLS[b.statut] ?? ''}`}>
                      <span className="badge-dot" />{t(`admin.statut.${b.statut}` as any)}
                    </span>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <button className="btn btn-ghost btn-sm" style={{ padding: '4px 8px' }} onClick={() => setEditId(b.id)}>
                      <Icon name="pencil" size={13} />
                    </button>
                  </td>
                </tr>
              ))}
              {!isLoading && bornes.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: '24px', color: 'var(--fg-3)' }}>{t('admin.bornes.aucune')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>
            {t('admin.bornes.page_sur')} {page} / {totalPages} · {total.toLocaleString()} {t('admin.bornes.bornes')}
          </span>
          <div style={{ display: 'flex', gap: 5 }}>
            <button onClick={() => setPage(1)} disabled={page === 1} style={{ ...inputSt, width: 32, cursor: 'pointer', height: 28, padding: '0 6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>«</button>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={{ ...inputSt, width: 32, cursor: 'pointer', height: 28, padding: '0 6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
            <span style={{ ...inputSt, width: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--rgnc-foret-700)', color: '#fff', height: 28 }}>{page}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ ...inputSt, width: 32, cursor: 'pointer', height: 28, padding: '0 6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
            <button onClick={() => setPage(totalPages)} disabled={page === totalPages} style={{ ...inputSt, width: 32, cursor: 'pointer', height: 28, padding: '0 6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>»</button>
          </div>
        </div>
      </div>

      {editId !== null && (
        <BorneSlideOver
          editId={editId === 'new' ? null : editId}
          onClose={() => setEditId(null)}
          onToast={onToast}
        />
      )}
    </div>
  )
}

// ── Section : Signalements (Kanban réel) ──────────────────────────────────────

type SigStatus = 'attente' | 'en_verification' | 'resolu' | 'rejete'

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

function SectionSignalements({ onToast }: { onToast: (m: string, t?: ToastType) => void }) {
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, alignItems: 'start' }}>
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
      )}
    </div>
  )
}

// ── Section : Import ──────────────────────────────────────────────────────────

type ImportStep = 'idle' | 'uploading' | 'done' | 'error'

function SectionImport({ onToast }: { onToast: (m: string, t?: ToastType) => void }) {
  const { t } = useLanguage()
  const [step,     setStep]     = useState<ImportStep>('idle')
  const [file,     setFile]     = useState<File | null>(null)
  const [result,   setResult]   = useState<ImportResult | null>(null)
  const [errMsg,   setErrMsg]   = useState('')
  const [dragging, setDragging] = useState(false)
  const importMut = useImportBornes()
  const fileRef   = useRef<HTMLInputElement>(null)

  const pickFile = (f: File | null | undefined) => {
    if (!f) return
    setFile(f); setStep('idle'); setResult(null); setErrMsg('')
  }

  const handleUpload = async () => {
    if (!file) return
    setStep('uploading')
    try {
      const res = await importMut.mutateAsync(file)
      setResult(res); setStep('done')
      onToast(`${t('admin.import.rapport')} : ${res.importees} ${t('admin.import.importees')}.`, 'success')
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || t('admin.import.erreur')
      setErrMsg(msg); setStep('error')
      onToast(msg, 'danger')
    }
  }

  const reset = () => { setStep('idle'); setFile(null); setResult(null); setErrMsg('') }

  const stepIdx = step === 'idle' ? (file ? 1 : 0) : step === 'uploading' || step === 'done' || step === 'error' ? 2 : 0
  const stepsUI = [
    { n: '1', label: t('admin.import.step1') },
    { n: '2', label: t('admin.import.step2') },
    { n: '3', label: t('admin.import.step3') },
  ]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, margin: 0 }}>{t('admin.title.import')}</h2>
        <span style={{ fontSize: 13, color: 'var(--fg-3)' }}>{t('admin.import.subtitle')}</span>
      </div>

      {/* Stepper */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 28 }}>
        {stepsUI.map(({ n, label }, i) => {
          const done   = i < stepIdx
          const active = i === stepIdx
          return (
            <React.Fragment key={n}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, background: done || active ? 'var(--rgnc-foret-700)' : 'var(--bg-sunken)', color: done || active ? '#fff' : 'var(--fg-3)', border: `2px solid ${done || active ? 'var(--rgnc-foret-700)' : 'var(--border-subtle)'}` }}>
                  {done ? <Icon name="check" size={13} color="#fff" strokeWidth={2.5} /> : n}
                </div>
                <span style={{ fontSize: 13, fontWeight: active ? 600 : 400, color: active ? 'var(--rgnc-foret-700)' : done ? 'var(--fg-2)' : 'var(--fg-3)' }}>{label}</span>
              </div>
              {i < 2 && <div style={{ width: 36, height: 1, background: 'var(--border-subtle)', margin: '0 8px' }} />}
            </React.Fragment>
          )
        })}
      </div>

      {/* Étape 1 — sélection */}
      {(step === 'idle' && !file) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }}>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files[0]) }}
            onClick={() => fileRef.current?.click()}
            style={{ border: `2px dashed ${dragging ? 'var(--rgnc-foret-700)' : 'var(--border-subtle)'}`, borderRadius: 'var(--radius-md)', background: dragging ? 'var(--rgnc-foret-50)' : 'var(--bg-surface)', padding: '64px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, cursor: 'pointer', transition: 'all 150ms' }}>
            <input ref={fileRef} type="file" accept=".csv,.json,.geojson,.pdf" style={{ display: 'none' }} onChange={(e) => pickFile(e.target.files?.[0])} />
            <div style={{ width: 64, height: 64, borderRadius: 'var(--radius-md)', border: '2px dashed var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-elevated)' }}>
              <Icon name="arrow-right" size={28} color="var(--fg-3)" style={{ transform: 'rotate(-90deg)' }} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg-1)', marginBottom: 6 }}>{t('admin.import.glisser')}</div>
              <div style={{ fontSize: 13, color: 'var(--fg-3)' }}>{t('admin.import.cliquer')}</div>
              <div style={{ fontSize: 12, color: 'var(--fg-4)', marginTop: 6 }}>{t('admin.import.formats_max')}</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="admin-card">
              <div className="admin-card-head"><h3>{t('admin.import.formats_titre')}</h3></div>
              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { fmt: 'CSV',  col: 'var(--rgnc-success)', desc: 'Modèle MINDCAF — colonnes requises' },
                  { fmt: 'PDF',  col: 'var(--rgnc-danger)',  desc: 'Fiches scannées — OCR côté serveur' },
                  { fmt: 'JSON', col: 'var(--rgnc-info)',    desc: 'GeoJSON WGS84 — export QGIS' },
                ].map(({ fmt, col, desc }) => (
                  <div key={fmt} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, background: 'var(--bg-sunken)', color: col, padding: '2px 7px', borderRadius: 'var(--radius-xs)', flexShrink: 0 }}>{fmt}</span>
                    <span style={{ fontSize: 12, color: 'var(--fg-2)', lineHeight: 1.5 }}>{desc}</span>
                  </div>
                ))}
              </div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={async () => {
              try {
                const blob = await importApi.telechargerModele()
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a'); a.href = url; a.download = 'modele-rgnc.csv'; a.click()
                URL.revokeObjectURL(url)
              } catch { onToast(t('admin.import.modele_absent'), 'warning') }
            }}>
              <Icon name="download" size={13} />{t('admin.import.modele')}
            </button>
          </div>
        </div>
      )}

      {/* Étape 2 — fichier sélectionné */}
      {(step === 'idle' && file) && (
        <div>
          <div className="admin-card" style={{ marginBottom: 16 }}>
            <div className="admin-card-head">
              <Icon name="file-text" size={15} color="var(--fg-3)" />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-2)' }}>{file.name}</span>
              <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>· {(file.size / 1024).toFixed(1)} Ko</span>
            </div>
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--fg-2)', fontSize: 13 }}>
              {t('admin.import.pret')}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost btn-sm" onClick={reset}>{t('admin.import.annuler')}</button>
            <button className="btn btn-primary btn-sm" onClick={handleUpload}>
              <Icon name="check" size={13} />{t('admin.import.lancer')}
            </button>
          </div>
        </div>
      )}

      {/* Uploading */}
      {step === 'uploading' && (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <Icon name="loader" size={32} color="var(--rgnc-foret-700)" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 16px', display: 'block' }} />
          <div style={{ fontSize: 14, color: 'var(--fg-2)' }}>{t('admin.import.en_cours')}</div>
        </div>
      )}

      {/* Rapport */}
      {step === 'done' && result && (
        <div style={{ maxWidth: 520 }}>
          <div className="admin-card">
            <div className="admin-card-head"><h3>{t('admin.import.rapport')}</h3></div>
            <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { count: result.importees, lbl: t('admin.import.importees'),    col: 'var(--rgnc-success)', bg: 'var(--rgnc-success-bg)' },
                { count: result.doublons,  lbl: t('admin.import.doublons'),     col: '#92700A',             bg: 'var(--rgnc-warning-bg)' },
                { count: result.erreurs,   lbl: t('admin.import.lignes_erreur'),col: 'var(--rgnc-danger)',  bg: 'var(--rgnc-danger-bg)' },
              ].map(({ count, lbl, col, bg }) => (
                <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px', borderRadius: 'var(--radius-sm)', background: bg }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 700, color: col, lineHeight: 1, flexShrink: 0 }}>{count}</span>
                  <span style={{ fontSize: 14, color: col, fontWeight: 500 }}>{lbl}</span>
                </div>
              ))}
              {result.details?.length > 0 && (
                <details style={{ marginTop: 8 }}>
                  <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--fg-3)' }}>{t('admin.import.detail')}</summary>
                  <table className="admin-table" style={{ marginTop: 8 }}>
                    <thead>
                      <tr>
                        <th>{t('admin.import.col.id')}</th>
                        <th>{t('admin.import.col.nom')}</th>
                        <th>{t('admin.import.col.statut')}</th>
                        <th>{t('admin.import.col.message')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.details.map((d, i) => (
                        <tr key={i} style={{ background: d.statut === 'erreur' ? 'var(--rgnc-danger-bg)' : d.statut === 'doublon' ? 'var(--rgnc-warning-bg)' : '' }}>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{d.id}</td>
                          <td>{d.nom}</td>
                          <td><span className={`badge ${d.statut === 'ok' ? 'badge-success' : d.statut === 'doublon' ? 'badge-warning' : 'badge-danger'}`}><span className="badge-dot" />{d.statut}</span></td>
                          <td style={{ fontSize: 11, color: 'var(--fg-3)' }}>{d.message || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              )}
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={reset}>
                  <Icon name="plus" size={13} />{t('admin.import.nouvel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Erreur */}
      {step === 'error' && (
        <div>
          <ApiError error={new Error(errMsg)} label={t('admin.import.erreur')} />
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={reset}>{t('admin.import.reessayer')}</button>
        </div>
      )}
    </div>
  )
}

// ── Section : Demandes d'accès ────────────────────────────────────────────────

function SectionRequests({ onToast }: { onToast: (m: string, t?: ToastType) => void }) {
  const { t } = useLanguage()
  const { data, isLoading, error } = useDemandes({ statut: 'attente' })
  const approveMut = useApproveDemande()
  const rejectMut  = useRejectDemande()
  const [expanded, setExpanded] = useState<number | null>(null)

  const demandes = data?.results ?? []

  const approve = async (id: number, nom: string) => {
    try {
      await approveMut.mutateAsync(id)
      onToast(`${nom} — ${t('admin.requests.approuver')}.`, 'success')
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
                onClick={() => approve(r.id, r.nom_complet)}
                disabled={approveMut.isPending || rejectMut.isPending}>
                <Icon name="check" size={13} />{t('admin.requests.approuver')}
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Section : Agents ──────────────────────────────────────────────────────────

function InviteModal({ onClose, onToast }: { onClose: () => void; onToast: (m: string, t?: ToastType) => void }) {
  const { t } = useLanguage()
  const inviteMut = useInviteAgent()
  const [email, setEmail] = useState('')
  const [role,  setRole]  = useState('geometre')
  const [msg,   setMsg]   = useState('')

  const send = async () => {
    try {
      await inviteMut.mutateAsync({ email, role, message: msg })
      onToast(`${t('admin.toast.invite_envoye')} ${email}.`, 'success')
      onClose()
    } catch (e: any) {
      onToast(e?.response?.data?.detail || t('admin.agents.erreur'), 'danger')
    }
  }

  const fld: React.CSSProperties = { width: '100%', ...inputSt, height: 34, display: 'block' }
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(14,27,34,0.5)' }} />
      <div style={{ position: 'relative', width: 400, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: 'var(--fg-1)' }}>{t('admin.invite.titre')}</div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--fg-2)', display: 'block', marginBottom: 4 }}>{t('admin.invite.email')}</label>
          <input style={fld} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="agent@organisme.cm" type="email" />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--fg-2)', display: 'block', marginBottom: 4 }}>{t('admin.invite.role')}</label>
          <select style={fld} value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="geometre">{t('admin.invite.geometre')}</option>
            <option value="admin">{t('admin.invite.administrateur')}</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--fg-2)', display: 'block', marginBottom: 4 }}>{t('admin.invite.message_opt')}</label>
          <textarea style={{ ...fld, height: 64, resize: 'vertical' }} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Message personnalisé dans l'email d'invitation…" />
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ flex: 1 }}>{t('admin.invite.annuler')}</button>
          <button className="btn btn-primary btn-sm" style={{ flex: 2 }} onClick={send} disabled={!email || inviteMut.isPending}>
            {inviteMut.isPending ? t('admin.invite.envoi') : t('admin.invite.envoyer')}
          </button>
        </div>
      </div>
    </div>
  )
}

function SectionAgents({ onToast }: { onToast: (m: string, t?: ToastType) => void }) {
  const { t } = useLanguage()
  const { data, isLoading, error } = useAdminUsers({ role: 'geometre' })
  const updateMut = useUpdateUser()
  const [showInvite, setShowInvite] = useState(false)

  const users: ProfilUtilisateur[] = data?.results ?? []

  const toggleVerif = async (u: ProfilUtilisateur) => {
    try {
      await updateMut.mutateAsync({ id: u.id, data: { est_verifie: !u.est_verifie } })
      onToast(`${u.nom_complet} — ${t('admin.toast.statut_maj')}.`, 'success')
    } catch (e: any) {
      onToast(e?.response?.data?.detail || t('admin.agents.erreur'), 'danger')
    }
  }

  if (isLoading) return <Spinner />
  if (error)     return <ApiError error={error} label={t('admin.agents.erreur')} />

  return (
    <>
      <div className="admin-card">
        <div className="admin-card-head">
          <h3>{t('admin.title.agents')}</h3>
          <span style={{ fontSize: 12, color: 'var(--fg-3)', marginLeft: 8 }}>{data?.count ?? 0} {t('admin.agents.agents')}</span>
          <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setShowInvite(true)}>
            <Icon name="plus" size={13} />{t('admin.agents.inviter')}
          </button>
        </div>
        {users.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--fg-3)', fontSize: 13 }}>{t('admin.agents.aucun')}</div>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                {[
                  t('admin.agents.col.nom'), t('admin.agents.col.email'),
                  t('admin.agents.col.org'), t('admin.agents.col.region'),
                  t('admin.agents.col.statut'), t('admin.agents.col.inscription'), '',
                ].map((h) => <th key={h}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 500 }}>{u.nom_complet}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--fg-2)' }}>{u.email}</td>
                  <td style={{ color: 'var(--fg-2)', fontSize: 12 }}>{u.organisation}</td>
                  <td style={{ color: 'var(--fg-2)', fontSize: 12 }}>{u.region_nom}</td>
                  <td>
                    {u.est_verifie
                      ? <span className="badge badge-success"><span className="badge-dot" />{t('admin.agents.verifie')}</span>
                      : <span className="badge badge-warning"><span className="badge-dot" />{t('admin.agents.en_attente')}</span>}
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-3)' }}>
                    {new Date(u.date_inscription).toLocaleDateString()}
                  </td>
                  <td>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => toggleVerif(u)}
                      disabled={updateMut.isPending}
                      title={u.est_verifie ? t('admin.requests.rejeter') : t('admin.agents.verifie')}
                    >
                      <Icon name={u.est_verifie ? 'x' : 'check'} size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {showInvite && <InviteModal onClose={() => setShowInvite(false)} onToast={onToast} />}
    </>
  )
}

// ── Main AdminPage ────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { t } = useLanguage()
  const router    = useRouter()
  const user      = useAuth((s) => s.user)
  const isAuth    = useAuth((s) => s.isAuthenticated)
  const isLoading = useAuth((s) => s.isLoading)
  const logout    = useAuth((s) => s.logout)
  const [section, setSection] = useState<AdminSection>('dashboard')
  const { toasts, push: toast } = useToast()

  // Navigation (computed from t so it updates with language)
  const NAV: { key: AdminSection; label: string; icon: string }[] = [
    { key: 'dashboard',    label: t('admin.nav.dashboard'),    icon: 'grid'           },
    { key: 'bornes',       label: t('admin.nav.bornes'),       icon: 'map-pin'        },
    { key: 'signalements', label: t('admin.nav.signalements'), icon: 'triangle-alert' },
    { key: 'import',       label: t('admin.nav.import'),       icon: 'arrow-right'    },
    { key: 'requests',     label: t('admin.nav.requests'),     icon: 'bell'           },
    { key: 'agents',       label: t('admin.nav.agents'),       icon: 'user'           },
  ]

  const TITLES: Record<AdminSection, string> = {
    dashboard:    t('admin.title.dashboard'),
    bornes:       t('admin.title.bornes'),
    signalements: t('admin.title.signalements'),
    import:       t('admin.title.import'),
    requests:     t('admin.title.requests'),
    agents:       t('admin.title.agents'),
  }

  // Badges dynamiques
  const { data: sigsData }     = useSignalements()
  const { data: demandesData } = useDemandes({ statut: 'attente' })
  const sigBadge     = sigsData?.results?.filter((s) => s.statut_traitement === 'attente').length ?? 0
  const demandeBadge = demandesData?.count ?? 0

  useEffect(() => {
    if (!isLoading && (!isAuth || user?.role !== 'admin')) {
      router.push(ROUTES.LOGIN)
    }
  }, [isAuth, isLoading, user, router])

  if (isLoading || !user || user.role !== 'admin') {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-3)' }}>
        {t('admin.permission')}
      </div>
    )
  }

  const handleLogout = () => { logout(); router.push(ROUTES.LOGIN) }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-app)', fontFamily: 'var(--font-body)' }}>

      {/* ── Sidebar ── */}
      <aside style={{ width: 232, background: 'var(--rgnc-foret-900)', borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div onClick={() => router.push(ROUTES.MAP)} style={{ padding: '16px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} title={t('admin.sidebar.retour')}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/logo/rgnc-webmap-wordmark.svg" alt="RGNC WebMap" style={{ height: 22, filter: 'brightness(0) invert(1) opacity(0.88)' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)', padding: '2px 7px', borderRadius: 'var(--radius-pill)', letterSpacing: '0.05em', marginLeft: 'auto', flexShrink: 0 }}>ADMIN</span>
        </div>

        <nav style={{ flex: 1, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
          {NAV.map(({ key, label, icon }) => {
            const badge = key === 'signalements' ? sigBadge : key === 'requests' ? demandeBadge : 0
            return (
              <button key={key} onClick={() => setSection(key)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font-body)', fontWeight: 500, background: section === key ? 'rgba(255,255,255,0.12)' : 'transparent', color: section === key ? '#fff' : 'rgba(255,255,255,0.6)', textAlign: 'left', width: '100%', transition: 'all 120ms' }}>
                <Icon name={icon as any} size={16} color={section === key ? '#fff' : 'rgba(255,255,255,0.5)'} />
                <span style={{ flex: 1 }}>{label}</span>
                {badge > 0 && (
                  <span style={{ background: 'var(--rgnc-laterite-500)', color: '#fff', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 'var(--radius-pill)', minWidth: 18, textAlign: 'center' }}>{badge}</span>
                )}
              </button>
            )
          })}
        </nav>

        <div style={{ padding: '10px 8px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <button onClick={() => router.push(ROUTES.MAP)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 'var(--radius-sm)', background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: 12, cursor: 'pointer', border: 'none', fontFamily: 'var(--font-body)', textAlign: 'left', width: '100%' }}>
            <Icon name="map" size={15} color="rgba(255,255,255,0.4)" />{t('admin.sidebar.retour')}
          </button>
          <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 'var(--radius-sm)', background: 'transparent', color: 'rgba(255,100,100,0.75)', fontSize: 12, cursor: 'pointer', border: 'none', fontFamily: 'var(--font-body)', textAlign: 'left', width: '100%' }}>
            <Icon name="log-out" size={15} color="rgba(255,100,100,0.6)" />{t('admin.sidebar.deconnexion')}
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Topbar */}
        <div style={{ height: 52, background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', padding: '0 24px', gap: 12, flexShrink: 0 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: 'var(--fg-1)', margin: 0 }}>{TITLES[section]}</h1>
          <span style={{ color: 'var(--fg-4)' }}>·</span>
          <span style={{ fontSize: 13, color: 'var(--fg-3)' }}>{t('admin.topbar.subtitle')}</span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
              {new Date().toLocaleDateString()}
            </span>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--rgnc-foret-700)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600 }}>
              {(user?.nom_complet || user?.username || 'AD').split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)}
            </div>
          </div>
        </div>

        {/* Corps */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
          {section === 'dashboard'    && <SectionDashboard    onGoTo={setSection} onToast={toast} />}
          {section === 'bornes'       && <SectionBornes       onToast={toast} />}
          {section === 'signalements' && <SectionSignalements onToast={toast} />}
          {section === 'import'       && <SectionImport       onToast={toast} />}
          {section === 'requests'     && <SectionRequests     onToast={toast} />}
          {section === 'agents'       && <SectionAgents       onToast={toast} />}
        </main>
      </div>

      <ToastStack toasts={toasts} />
    </div>
  )
}
