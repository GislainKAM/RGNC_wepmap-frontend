'use client'

import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Icon } from '@/components/ui/Icon'
import { OrdreIcon } from '@/components/ui/OrdreIcon'
import { useLanguage } from '@/hooks/useLanguage'
import { departementApi, communeApi } from '@/lib/api'
import type {
  FiltresCarteState, Region, Departement, Commune,
  StatutBorne, OrdreBorne, ReseauBorne, StatsRGNC,
  GeoJSONFeatureCollection,
} from '@/lib/types'

// ── Types ────────────────────────────────────────────────────────

interface FiltersPanelProps {
  filters:         FiltresCarteState
  onFiltersChange: (f: FiltresCarteState) => void
  collapsed:       boolean
  onClose?:        () => void   // ferme le drawer sur mobile (tap backdrop ou bouton X)
  regions:         Region[]
  stats?:          StatsRGNC | null
  geojson?:        GeoJSONFeatureCollection | null   // points actuellement visibles sur la carte
  total?:          number                            // nb de points visibles
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

// ── Select stylé (factorisation) ────────────────────────────────
interface SelectFilterProps {
  value:       string | number
  onChange:    (e: React.ChangeEvent<HTMLSelectElement>) => void
  placeholder: string
  disabled:    boolean
  children:    React.ReactNode
}

function SelectFilter({ value, onChange, placeholder, disabled, children }: SelectFilterProps) {
  return (
    <select
      value={value}
      onChange={onChange}
      disabled={disabled}
      style={{
        width:        '100%',
        fontFamily:   'var(--font-body)',
        fontSize:     'var(--fs-sm)',
        padding:      '7px 10px',
        background:   disabled ? 'var(--bg-muted, var(--bg-sunken))' : 'var(--bg-sunken)',
        border:       '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-xs)',
        color:        disabled ? 'var(--fg-3)' : 'var(--fg-1)',
        outline:      'none',
        cursor:       disabled ? 'not-allowed' : 'pointer',
        opacity:      disabled ? 0.6 : 1,
        appearance:   'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%235A6770' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
        backgroundRepeat:   'no-repeat',
        backgroundPosition: 'right 10px center',
        paddingRight:       32,
      }}
    >
      <option value="">{placeholder}</option>
      {children}
    </select>
  )
}

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
  filters, onFiltersChange, collapsed, onClose, regions, stats, geojson, total,
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

  // ── Données cascadantes Région → Département → Commune ──────
  // Les départements se chargent dès qu'une région est sélectionnée
  // (ou la liste complète si aucune région n'est filtrée)
  const { data: departements = [], isFetching: deptLoading } = useQuery<Departement[]>({
    queryKey: ['departements', filters.regionId],
    queryFn:  () => departementApi.list(filters.regionId ?? undefined),
    staleTime: 60 * 60 * 1000,
  })

  // Les communes se chargent uniquement si un département est sélectionné
  const { data: communes = [], isFetching: communeLoading } = useQuery<Commune[]>({
    queryKey: ['communes', filters.departementId],
    queryFn:  () => communeApi.list(filters.departementId ?? undefined),
    enabled:  filters.departementId != null,
    staleTime: 60 * 60 * 1000,
  })

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
    // Réinitialise département ET commune pour maintenir la cohérence hiérarchique
    onFiltersChange({ ...filters, regionId: val, departementId: null, communeId: null })
  }

  const handleDept = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value ? Number(e.target.value) : null
    // Réinitialise commune si on change de département
    onFiltersChange({ ...filters, departementId: val, communeId: null })
  }

  const handleCommune = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value ? Number(e.target.value) : null
    onFiltersChange({ ...filters, communeId: val })
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

  // ── Compteurs : points visibles sur la carte (réactifs aux filtres) ──────────
  // Si geojson disponible → compteurs en temps réel depuis les features affichées
  // Sinon → fallback sur les stats globales du backend

  const visibleFeatures = geojson?.features ?? []

  const getStatutCount = (s: StatutBorne): number | undefined => {
    if (visibleFeatures.length > 0) {
      return visibleFeatures.filter((f) => f.properties?.statut === s).length
    }
    return stats?.par_statut.find((x) => x.statut === s)?.nb
  }

  const getOrdreCount = (o: OrdreBorne): number | undefined => {
    if (visibleFeatures.length > 0) {
      return visibleFeatures.filter((f) => f.properties?.ordre === o).length
    }
    return stats?.par_ordre.find((x) => x.ordre === o)?.nb
  }

  // ── Badge header ─────────────────────────────────────────────

  const activeCount =
    filters.statuts.length +
    filters.ordres.length +
    (filters.regionId      ? 1 : 0) +
    (filters.departementId ? 1 : 0) +
    (filters.communeId     ? 1 : 0) +
    (filters.reseau        ? 1 : 0)

  const headerBadge = activeCount > 0
    ? `${activeCount} ${activeCount > 1 ? t('filters.actifs_pl') : t('filters.actifs')}`
    : total != null
      ? `${total.toLocaleString(locale)} ${t('filters.pts')}`
      : null

  // ── Rendu ────────────────────────────────────────────────────

  return (
    <>
      {/* ── Backdrop mobile (tapez pour fermer) ── */}
      {!collapsed && (
        <div
          className="filters-backdrop"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside className={`filters-panel${collapsed ? ' collapsed' : ''}`} aria-label="Filtres">

      {/* ── En-tête ── */}
      <div className="filters-head">
        <h2>{t('filters.title')}</h2>
        {headerBadge && (
          <span className="filters-count">{headerBadge}</span>
        )}
        {/* Bouton fermeture — visible seulement sur mobile via CSS */}
        <button
          className="filters-close-btn"
          onClick={onClose}
          aria-label="Fermer les filtres"
        >
          <Icon name="x" size={16} />
        </button>
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

        {/* ── Localisation administrative : Région → Département → Commune ── */}
        <div className="filter-group">
          <p className="filter-group-label">{t('filters.region.title')}</p>
          <SelectFilter
            value={filters.regionId ?? ''}
            onChange={handleRegion}
            placeholder={t('filters.region.all')}
            disabled={false}
          >
            {(Array.isArray(regions) ? regions : []).map((r) => (
              <option key={r.id} value={r.id}>{r.nom}</option>
            ))}
          </SelectFilter>
        </div>

        <div className="filter-group">
          <p className="filter-group-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {t('filters.dept.title')}
            {deptLoading && <span className="filter-spinner" />}
          </p>
          <SelectFilter
            value={filters.departementId ?? ''}
            onChange={handleDept}
            placeholder={departements.length === 0 && !deptLoading
              ? t('filters.dept.ph')
              : t('filters.dept.all')}
            disabled={false}
          >
            {departements.map((d) => (
              <option key={d.id} value={d.id}>{d.nom}</option>
            ))}
          </SelectFilter>
          {filters.departementId && (
            <button
              className="filter-clear-link"
              onClick={() => onFiltersChange({ ...filters, departementId: null, communeId: null })}
            >
              <Icon name="x" size={10} />
              {lang === 'fr' ? 'Effacer' : 'Clear'}
            </button>
          )}
        </div>

        <div className="filter-group">
          <p className="filter-group-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {t('filters.commune.title')}
            {communeLoading && <span className="filter-spinner" />}
          </p>
          <SelectFilter
            value={filters.communeId ?? ''}
            onChange={handleCommune}
            placeholder={filters.departementId == null
              ? t('filters.commune.ph')
              : t('filters.commune.all')}
            disabled={filters.departementId == null}
          >
            {communes.map((c) => (
              <option key={c.id} value={c.id}>{c.nom}</option>
            ))}
          </SelectFilter>
          {filters.communeId && (
            <button
              className="filter-clear-link"
              onClick={() => onFiltersChange({ ...filters, communeId: null })}
            >
              <Icon name="x" size={10} />
              {lang === 'fr' ? 'Effacer' : 'Clear'}
            </button>
          )}
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
        {/* Les filtres sont réactifs — pas besoin de bouton "Appliquer" */}
        {activeCount > 0 && (
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--rgnc-foret-700)', fontWeight: 500 }}>
            <Icon name="check" size={11} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />
            {t('filters.actifs_pl') ? `${activeCount} ${t('filters.actifs_pl')}` : `${activeCount} filtre(s) actif(s)`}
          </span>
        )}
      </div>

    </aside>
    </>
  )
}
