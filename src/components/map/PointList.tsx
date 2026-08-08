'use client'

import React, { useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { Button } from '@/components/ui/Button'
import { StatutBadge } from '@/components/ui/Badge'
import { OrdreIcon } from '@/components/ui/OrdreIcon'
import { useLanguage } from '@/hooks/useLanguage'
import type { GeoJSONFeature } from '@/lib/types'

interface PointListProps {
  points: GeoJSONFeature[]
  onPickPoint: (id: number) => void
  isLoading: boolean
  /** Ouvre ou referme le panneau de filtres. */
  onBasculerFiltres?: () => void
  /** Nombre de critères actifs, affiché sur le bouton Filtrer. */
  nbFiltresActifs?: number
}

type SortKey = 'matricule' | 'nom' | 'ordre' | 'statut' | 'latitude_dd' | 'longitude_dd' | 'altitude_ngac' | 'region_nom' | 'commune_nom' | 'reseau' | 'distance'
type SortDir = 'asc' | 'desc'

/**
 * Distance à vol d'oiseau entre deux positions géographiques, en mètres.
 *
 * Formule de haversine : elle assimile la Terre à une sphère de rayon
 * moyen. L'écart avec l'ellipsoïde atteint 0,5 % au pire, soit 5 m sur
 * 1 km — sans conséquence ici, où la distance sert à ordonner des bornes
 * et à indiquer un ordre de grandeur, jamais à un calcul géodésique.
 * Les coordonnées précises restent disponibles dans la fiche.
 */
function distanceMetres(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const rad = Math.PI / 180
  const dLat = (lat2 - lat1) * rad
  const dLon = (lon2 - lon1) * rad
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

export function PointList({
  points, onPickPoint, isLoading,
  onBasculerFiltres, nbFiltresActifs = 0,
}: PointListProps) {
  const { t, lang } = useLanguage()
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US'

  const [sortKey, setSortKey] = useState<SortKey>('matricule')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  // Position de l'utilisateur, renseignée à la demande uniquement.
  const [maPosition, setMaPosition] = useState<{ lat: number; lon: number } | null>(null)
  const [geoEtat, setGeoEtat] = useState<'inactif' | 'attente' | 'refuse' | 'indisponible'>('inactif')

  const localiser = () => {
    if (!navigator.geolocation) { setGeoEtat('indisponible'); return }
    setGeoEtat('attente')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setMaPosition({ lat: pos.coords.latitude, lon: pos.coords.longitude })
        setGeoEtat('inactif')
        setSortKey('distance')
        setSortDir('asc')
      },
      // Un refus de permission et un GPS qui ne capte pas sous couvert
      // forestier produisent la même erreur pour l'utilisateur : on
      // distingue les deux pour pouvoir l'expliquer.
      (err) => setGeoEtat(err.code === err.PERMISSION_DENIED ? 'refuse' : 'indisponible'),
      // enableHighAccuracy : sur le terrain, le GPS du téléphone plutôt
      // que la triangulation réseau, qui peut se tromper de plusieurs km.
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    )
  }

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  // Les coordonnées ne sont plus dupliquées dans les propriétés : l'API ne
  // les envoie que dans `geometry`, ce qui allège la réponse de 17 %.
  // `coord` les en extrait — [longitude, latitude] par convention GeoJSON,
  // dans cet ordre (et non lat/lon comme on l'écrit habituellement).
  const coord = (f: any, axe: 'lat' | 'lon'): number | null => {
    const c = f?.geometry?.coordinates
    if (!Array.isArray(c) || c.length < 2) return null
    return axe === 'lat' ? c[1] : c[0]
  }

  const distanceDe = (f: any): number | null => {
    if (!maPosition) return null
    const lat = coord(f, 'lat'), lon = coord(f, 'lon')
    if (lat == null || lon == null) return null
    return distanceMetres(maPosition.lat, maPosition.lon, lat, lon)
  }

  const valeurTri = (f: any) => {
    if (sortKey === 'latitude_dd')  return coord(f, 'lat')
    if (sortKey === 'longitude_dd') return coord(f, 'lon')
    if (sortKey === 'distance')     return distanceDe(f)
    return (f.properties as any)[sortKey]
  }

  const sorted = [...points].sort((a, b) => {
    const av = valeurTri(a)
    const bv = valeurTri(b)
    if (av == null) return 1
    if (bv == null) return -1
    const cmp = typeof av === 'string' ? av.localeCompare(bv) : av - bv
    return sortDir === 'asc' ? cmp : -cmp
  })

  const exportCsv = () => {
    const header = [
      t('list.col.code'), t('list.col.nom'), t('list.col.ordre'), t('list.col.statut'),
      t('list.col.lat'), t('list.col.lon'), t('list.col.alt'), t('list.col.region'), 'Commune',
    ]
    const rows = sorted.map((f) => {
      const p = f.properties as any
      return [
        p.matricule,
        `"${p.nom}"`,
        p.ordre,
        p.statut,
        coord(f, 'lat') ?? '',
        coord(f, 'lon') ?? '',
        p.altitude_ngac ?? '',
        `"${p.region_nom}"`,
        `"${p.commune_nom}"`,
      ].join(',')
    })
    const csv = [header.join(','), ...rows].join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = 'rgnc_points.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const SortIcon = ({ col }: { col: SortKey }) =>
    sortKey === col ? (
      <Icon
        name="sort-asc"
        size={11}
        style={{ transform: sortDir === 'desc' ? 'scaleY(-1)' : undefined, opacity: 0.7 }}
      />
    ) : null

  /** Distance lisible : le mètre sous 1 km, le kilomètre au-delà. */
  const distanceLisible = (f: GeoJSONFeature): string => {
    const d = distanceDe(f)
    if (d == null) return '—'
    return d < 1000 ? `${Math.round(d)} m` : `${(d / 1000).toFixed(1)} km`
  }

  const materiau = (reseau: string | undefined): string => {
    if (reseau?.startsWith('DENSIF')) return t('list.mat.beton')
    if (reseau === 'AUTRE') return t('list.mat.repere')
    return t('list.mat.pilier')
  }

  const couleurStatut = (statut: string): string =>
    statut === 'actif'   ? '#1F5D3A' :
    statut === 'degrade' ? '#D4A017' :
    statut === 'detruit' ? '#B83434' : '#9BA5AC'

  // Critères proposés au tri sur mobile, où il n'y a pas d'en-tête à cliquer.
  // Volontairement plus courts que les colonnes du tableau : trier des bornes
  // par longitude n'a pas de sens au doigt, trier par distance en a beaucoup.
  const criteresTri: { key: SortKey; label: string }[] = [
    { key: 'matricule',   label: t('list.col.code')   },
    { key: 'nom',         label: t('list.col.nom')    },
    { key: 'ordre',       label: t('list.col.ordre')  },
    { key: 'statut',      label: t('list.col.statut') },
    { key: 'region_nom',  label: t('list.col.region') },
    ...(maPosition ? [{ key: 'distance' as SortKey, label: t('list.col.distance') }] : []),
  ]

  const etatVide = (
    <div className="list-vide">
      <Icon name="map-pin" size={28} color="var(--fg-4)" style={{ margin: '0 auto 10px', display: 'block' }} />
      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--fg-2)' }}>{t('list.empty.title')}</div>
      <div style={{ fontSize: 13, marginTop: 4 }}>{t('list.empty.sub')}</div>
    </div>
  )

  return (
    <div className="list-view">
      {/* Toolbar */}
      <div className="list-toolbar">
        <span className="list-count">
          <b>{sorted.length.toLocaleString(locale)}</b> {sorted.length !== 1 ? t('list.points') : t('list.point')} · {t('list.zone')}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Premier bouton de la barre : sur le terrain, « quelle borne est
              la plus proche de moi » est la question la plus fréquente. */}
          <Button
            variant={maPosition ? 'secondary' : 'ghost'}
            size="sm"
            onClick={localiser}
            disabled={geoEtat === 'attente'}
            title={maPosition ? t('list.geo.trier') : t('list.geo.utiliser')}
          >
            <Icon name="map-pin" size={13} />
            {geoEtat === 'attente' ? t('list.geo.attente') : t('list.geo.pres')}
          </Button>
          {geoEtat === 'refuse' && (
            <span style={{ fontSize: 11, color: 'var(--rgnc-danger)' }} role="status">
              {t('list.geo.refuse')}
            </span>
          )}
          {geoEtat === 'indisponible' && (
            <span style={{ fontSize: 11, color: 'var(--fg-3)' }} role="status">
              {t('list.geo.indispo')}
            </span>
          )}
          {/* Ce bouton n'avait aucun gestionnaire : il donnait l'apparence
              d'une commande là où rien ne se passait. Il ouvre désormais le
              panneau, ce qui compte surtout sur mobile où celui-ci est
              replié et où la carte — seul autre accès — n'est pas
              affichée. */}
          <Button
            variant={nbFiltresActifs > 0 ? 'secondary' : 'ghost'}
            size="sm"
            onClick={onBasculerFiltres}
          >
            <Icon name="filter" size={13} />
            {t('list.filtrer')}
            {nbFiltresActifs > 0 && ` (${nbFiltresActifs})`}
          </Button>
          <Button variant="secondary" size="sm" onClick={exportCsv}>
            <Icon name="download" size={13} />
            {t('list.export')}
          </Button>
        </div>
      </div>

      {/* ── Tri — mobile uniquement ──
          Les cartes n'ont pas d'en-tête de colonne à cliquer : sans cette
          barre, le tri deviendrait inaccessible dès qu'on quitte le grand
          écran. */}
      <div className="list-tri">
        <label className="list-tri-label" htmlFor="tri-liste">{t('list.trier')}</label>
        <select
          id="tri-liste"
          className="list-tri-select"
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
        >
          {criteresTri.map(({ key, label }) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <button
          type="button"
          className="list-tri-sens"
          onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
          aria-label={sortDir === 'asc' ? t('list.tri.croissant') : t('list.tri.decroissant')}
          title={sortDir === 'asc' ? t('list.tri.croissant') : t('list.tri.decroissant')}
        >
          <Icon name="sort-asc" size={14}
            style={{ transform: sortDir === 'desc' ? 'scaleY(-1)' : undefined }} />
        </button>
      </div>

      {/* Table */}
      <div className="list-table-wrap">
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--fg-3)' }}>
            {t('fiche.loading')}
          </div>
        ) : sorted.length === 0 ? etatVide : (
          <>
          {/* ── Cartes — mobile ──
              Le tableau compte dix colonnes ; sur un écran de 375 px il ne
              se consultait qu'en le faisant défiler latéralement, colonne
              par colonne. Les cartes retiennent ce qu'un géomètre lit en
              premier : le matricule, l'état de la borne, où elle se trouve
              et à quelle distance. Le détail complet reste dans la fiche,
              à un appui. */}
          <ul className="list-cartes">
            {sorted.map((feature) => {
              const p = feature.properties as any
              return (
                <li key={feature.id}>
                  <button
                    type="button"
                    className="list-carte"
                    onClick={() => onPickPoint(feature.id as number)}
                  >
                    <span className="lc-ligne1">
                      <span className="lc-matricule">{p.matricule}</span>
                      <StatutBadge statut={p.statut} />
                    </span>

                    <span className="lc-nom">{p.nom}</span>

                    <span className="lc-ligne3">
                      <span className="lc-ordre">
                        <OrdreIcon ordre={p.ordre} size={12} color={couleurStatut(p.statut)} />
                        {p.ordre_label || `Ord. ${p.ordre}`}
                      </span>
                      <span className="lc-sep" aria-hidden="true">·</span>
                      <span className="lc-lieu">{p.commune_nom || p.region_nom || '—'}</span>
                      {maPosition && (
                        <span className="lc-distance">{distanceLisible(feature)}</span>
                      )}
                    </span>

                    <span className="lc-coords">
                      {coord(feature, 'lat')?.toFixed(5)}° {coord(feature, 'lon')?.toFixed(5)}°
                      <span className="lc-materiau">{materiau(p.reseau)}</span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>

          <table className="list-table">
            <thead>
              <tr>
                {([
                  { key: 'matricule',    label: t('list.col.code')    },
                  { key: 'nom',          label: t('list.col.nom')     },
                  { key: 'ordre',        label: t('list.col.ordre')   },
                  { key: 'reseau',       label: t('list.col.materiau')},
                  { key: 'statut',       label: t('list.col.statut')  },
                  ...(maPosition ? [{ key: 'distance' as SortKey, label: t('list.col.distance') }] : []),
                  { key: 'latitude_dd',  label: t('list.col.lat')     },
                  { key: 'longitude_dd', label: t('list.col.lon')     },
                  { key: 'altitude_ngac',label: t('list.col.alt')     },
                  { key: 'region_nom',   label: t('list.col.region')  },
                ] as { key: SortKey; label: string }[]).map(({ key, label }) => (
                  <th key={key} onClick={() => handleSort(key)} style={{ userSelect: 'none' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {label} <SortIcon col={key} />
                    </span>
                  </th>
                ))}
                <th style={{ width: 32 }} />
              </tr>
            </thead>
            <tbody>
              {sorted.map((feature) => {
                  const p = feature.properties as any
                  const mat = materiau(p.reseau)
                  return (
                    <tr
                      key={feature.id}
                      onClick={() => onPickPoint(feature.id as number)}
                      style={{ cursor: 'pointer' }}
                    >
                      <td className="mono-cell" style={{ fontWeight: 600 }}>{p.matricule}</td>
                      <td style={{ fontWeight: 500, maxWidth: 180 }}>{p.nom}</td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <OrdreIcon ordre={p.ordre} size={13} color={
                            p.statut === 'actif'   ? '#1F5D3A' :
                            p.statut === 'degrade' ? '#D4A017' :
                            p.statut === 'detruit' ? '#B83434' : '#9BA5AC'
                          } />
                          <span className="muted-cell" style={{ fontSize: 12 }}>{p.ordre_label || `Ord. ${p.ordre}`}</span>
                        </span>
                      </td>
                      <td className="muted-cell">{mat}</td>
                      <td><StatutBadge statut={p.statut} /></td>
                      {maPosition && (
                        <td className="mono-cell">{distanceLisible(feature)}</td>
                      )}
                      <td className="mono-cell">{coord(feature, 'lat')?.toFixed(5)}°</td>
                      <td className="mono-cell">{coord(feature, 'lon')?.toFixed(5)}°</td>
                      <td className="mono-cell">
                        {p.altitude_ngac != null ? `${p.altitude_ngac.toFixed(2)} m` : <span className="muted-cell">—</span>}
                      </td>
                      <td className="muted-cell">{p.region_nom}</td>
                      <td><Icon name="arrow-right" size={14} color="var(--fg-4)" /></td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
          </>
        )}
      </div>
    </div>
  )
}
