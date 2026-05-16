'use client'

import React from 'react'
import { Icon } from '@/components/ui/Icon'
import { OrdreIcon } from '@/components/ui/OrdreIcon'
import { useLanguage } from '@/hooks/useLanguage'
import type {
  FiltresCarteState, Region, StatutBorne, OrdreBorne, ReseauBorne, StatsRGNC,
} from '@/lib/types'

// ── Types ────────────────────────────────────────────────────────

interface FiltersPanelProps {
  filters:         FiltresCarteState
  onFiltersChange: (f: FiltresCarteState) => void
  collapsed:       boolean
  regions:         Region[]
  stats?:          StatsRGNC | null
  total?:          number          // nb de points visibles sur la carte
}

// Couleur neutre pour les icônes d'ordre dans les filtres.
// Sur la carte, c'est le STATUT qui détermine la couleur — l'ordre ne varie que la forme.
const ORDRE_ICON_COLOR = '#26343C'   // var(--rgnc-encre-900) — neutre, pas de confusion avec les statuts

// ── Données statiques (values + colors uniquement — labels via t()) ──

const STATUTS_DEF: { value: StatutBorne; color: string }[] = [
  { value: 'actif',   color: 'var(--rgnc-success)' },
  { value: 'degrade', color: 'var(--rgnc-warning)' },
  { value: 'detruit', color: 'var(--rgnc-danger)'  },
  { value: 'inconnu', color: 'var(--fg-4)'         },
]

const ORDRES_DEF: { value: OrdreBorne }[] = [
  { value: 1 },
  { value: 2 },
  { value: 3 },
]

const RESEAUX: { value: ReseauBorne; label: string }[] = [
  { value: 'PAMOCCA',     label: 'PAMOCCA 2011'      },
  { value: 'DENSIF_2018', label: 'Densification 2018' },
  { value: 'DENSIF_2019', label: 'Densification 2019' },
  { value: 'DENSIF_2021', label: 'Densification 2021' },
  { value: 'DENSIF_2025', label: 'Densification 2025' },
]

// ── Sous-composants ──────────────────────────────────────────────

function CheckBox({ checked }: { checked: boolean }) {
  return (
    <span className={`check-box${checked ? ' on' : ''}`} style={{ flexShrink: 0 }}>
      {checked && (
        <Icon name="check" size={10} color="#fff" strokeWidth={2.5} />
      )}
    </span>
  )
}

interface FilterRowProps {
  checked:   boolean
  onToggle:  () => void
  label:     string
  sublabel?: string
  count?:    number
  dotColor?: string
  icon?:     React.ReactNode
}

function FilterRow({ checked, onToggle, label, sublabel, count, dotColor, icon }: FilterRowProps) {
  return (
    <div className="filter-row" onClick={onToggle} style={{ cursor: 'pointer' }}>
      <CheckBox checked={checked} />
      {icon}
      {dotColor && <span className="status-dot" style={{ background: dotColor }} />}
      <span style={{ flex: 1 }}>
        {label}
        {sublabel && (
          <span style={{ display: 'block', fontSize: 10, color: 'var(--fg-3)', marginTop: 1 }}>
            {sublabel}
          </span>
        )}
      </span>
      {count !== undefined && (
        <span className="fc">{count.toLocaleString()}</span>
      )}
    </div>
  )
}

// ── Composant principal ──────────────────────────────────────────

export function FiltersPanel({
  filters, onFiltersChange, collapsed, regions, stats, total,
}: FiltersPanelProps) {

  const { t, lang } = useLanguage()
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US'

  // ── Labels traduits ──────────────────────────────────────────
  const STATUTS = STATUTS_DEF.map((s) => ({
    ...s,
    label: t(`filters.statut.${s.value}` as any),
  }))

  const ORDRES = ORDRES_DEF.map(({ value }) => ({
    value,
    label:    t(`filters.ordre.${value}.label` as any),
    sublabel: t(`filters.ordre.${value}.sub`   as any),
  }))

  // ── Handlers ──────────────────────────────────────────────────

  const toggleStatut = (s: StatutBorne) => {
    const next = filters.statuts.includes(s)
      ? filters.statuts.filter((x) => x !== s)
      : [...filters.statuts, s]
    onFiltersChange({ ...filters, statuts: next })
  }

  const toggleOrdre = (o: OrdreBorne) => {
    const next = filters.ordres.includes(o)
      ? filters.ordres.filter((x) => x !== o)
      : [...filters.ordres, o]
    onFiltersChange({ ...filters, ordres: next })
  }

  // Réseau = sélection exclusive (un seul à la fois, reclique → désélectionne)
  const toggleReseau = (r: ReseauBorne) => {
    onFiltersChange({ ...filters, reseau: filters.reseau === r ? null : r })
  }

  const handleRegion = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value ? Number(e.target.value) : null
    onFiltersChange({ ...filters, regionId: val })
  }

  const reset = () => {
    onFiltersChange({
      statuts:       [],
      ordres:        [],
      regionId:      null,
      departementId: null,
      communeId:     null,
      reseau:        null,
      recherche:     '',
    })
  }

  // ── Compteurs depuis les stats backend ────────────────────────

  const getStatutCount = (s: StatutBorne): number | undefined =>
    stats?.par_statut.find((x) => x.statut === s)?.nb

  const getOrdreCount = (o: OrdreBorne): number | undefined =>
    stats?.par_ordre.find((x) => x.ordre === o)?.nb

  // ── Badge header ─────────────────────────────────────────────

  const activeCount =
    filters.statuts.length +
    filters.ordres.length +
    (filters.regionId ? 1 : 0) +
    (filters.reseau   ? 1 : 0)

  const headerBadge = activeCount > 0
    ? `${activeCount} ${activeCount > 1 ? t('filters.actifs_pl') : t('filters.actifs')}`
    : total != null
      ? `${total.toLocaleString(locale)} ${t('filters.pts')}`
      : null

  // ── Rendu ────────────────────────────────────────────────────

  return (
    <aside className={`filters-panel${collapsed ? ' collapsed' : ''}`} aria-label="Filtres">

      {/* ── En-tête ── */}
      <div className="filters-head">
        <h2>{t('filters.title')}</h2>
        {headerBadge && (
          <span className="filters-count">{headerBadge}</span>
        )}
      </div>

      {/* ── Corps ── */}
      <div className="filters-body">

        {/* ── Ordre réseau ── */}
        <div className="filter-group">
          <p className="filter-group-label">{t('filters.ordre.title')}</p>

          {ORDRES.map(({ value, label, sublabel }) => (
            <FilterRow
              key={value}
              checked={filters.ordres.includes(value)}
              onToggle={() => toggleOrdre(value)}
              label={label}
              sublabel={sublabel}
              count={getOrdreCount(value)}
              icon={<OrdreIcon ordre={value} size={15} color={ORDRE_ICON_COLOR} />}
            />
          ))}

        </div>

        {/* ── Statut ── */}
        <div className="filter-group">
          <p className="filter-group-label">{t('filters.statut.title')}</p>
          {STATUTS.map(({ value, label, color }) => (
            <FilterRow
              key={value}
              checked={filters.statuts.includes(value)}
              onToggle={() => toggleStatut(value)}
              label={label}
              count={getStatutCount(value)}
              dotColor={color}
            />
          ))}
        </div>

        {/* ── Région ── */}
        <div className="filter-group">
          <p className="filter-group-label">{t('filters.region.title')}</p>
          <select
            value={filters.regionId ?? ''}
            onChange={handleRegion}
            style={{
              width:        '100%',
              fontFamily:   'var(--font-body)',
              fontSize:     'var(--fs-sm)',
              padding:      '7px 10px',
              background:   'var(--bg-sunken)',
              border:       '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-xs)',
              color:        'var(--fg-1)',
              outline:      'none',
              cursor:       'pointer',
              appearance:   'none',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%235A6770' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
              backgroundRepeat:   'no-repeat',
              backgroundPosition: 'right 10px center',
              paddingRight:       32,
            }}
          >
            <option value="">{t('filters.region.all')}</option>
            {(Array.isArray(regions) ? regions : []).map((r) => (
              <option key={r.id} value={r.id}>{r.nom}</option>
            ))}
          </select>
        </div>

        {/* ── Réseau / Campagne ── */}
        <div className="filter-group">
          <p className="filter-group-label">{t('filters.reseau.title')}</p>
          {RESEAUX.map(({ value, label }) => (
            <FilterRow
              key={value}
              checked={filters.reseau === value}
              onToggle={() => toggleReseau(value)}
              label={label}
            />
          ))}
        </div>

      </div>

      {/* ── Pied ── */}
      <div className="filters-foot">
        <button
          className="btn btn-ghost btn-sm"
          onClick={reset}
          disabled={activeCount === 0}
          style={{ opacity: activeCount === 0 ? 0.45 : 1 }}
        >
          <Icon name="x" size={12} />
          {t('filters.reset')}
        </button>
        <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }}>
          <Icon name="filter" size={12} />
          {t('filters.apply')}
        </button>
      </div>

    </aside>
  )
}
