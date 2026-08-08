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

export function PointList({ points, onPickPoint, isLoading }: PointListProps) {
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
          <Button variant="ghost" size="sm">
            <Icon name="filter" size={13} />
            {t('list.filtrer')}
          </Button>
          <Button variant="secondary" size="sm" onClick={exportCsv}>
            <Icon name="download" size={13} />
            {t('list.export')}
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="list-table-wrap">
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '48px', color: 'var(--fg-3)' }}>
            {t('fiche.loading')}
          </div>
        ) : (
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
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--fg-3)' }}>
                    <Icon name="map-pin" size={28} color="var(--fg-4)" style={{ margin: '0 auto 10px', display: 'block' }} />
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--fg-2)' }}>{t('list.empty.title')}</div>
                    <div style={{ fontSize: 13, marginTop: 4 }}>{t('list.empty.sub')}</div>
                  </td>
                </tr>
              ) : (
                sorted.map((feature) => {
                  const p = feature.properties as any
                  const matLabel: Record<string, string> = {
                    PAMOCCA: t('list.mat.pilier'),
                    AUTRE:   t('list.mat.repere'),
                  }
                  const mat = p.reseau?.startsWith('DENSIF') ? t('list.mat.beton') : (matLabel[p.reseau] ?? t('list.mat.pilier'))
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
                        <td className="mono-cell">
                          {(() => {
                            const d = distanceDe(feature)
                            if (d == null) return '—'
                            // Sous 1 km, le mètre est l'unité utile sur le
                            // terrain ; au-delà, le kilomètre suffit.
                            return d < 1000
                              ? `${Math.round(d)} m`
                              : `${(d / 1000).toFixed(1)} km`
                          })()}
                        </td>
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
                })
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
