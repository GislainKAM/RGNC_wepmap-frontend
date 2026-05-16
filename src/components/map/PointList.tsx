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

type SortKey = 'matricule' | 'nom' | 'ordre' | 'statut' | 'latitude_dd' | 'longitude_dd' | 'altitude_ngac' | 'region_nom' | 'commune_nom' | 'reseau'
type SortDir = 'asc' | 'desc'

export function PointList({ points, onPickPoint, isLoading }: PointListProps) {
  const { t, lang } = useLanguage()
  const locale = lang === 'fr' ? 'fr-FR' : 'en-US'

  const [sortKey, setSortKey] = useState<SortKey>('matricule')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sorted = [...points].sort((a, b) => {
    const av = (a.properties as any)[sortKey]
    const bv = (b.properties as any)[sortKey]
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
        p.latitude_dd,
        p.longitude_dd,
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
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
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
                          <OrdreIcon ordre={p.ordre} size={13} />
                          <span className="muted-cell" style={{ fontSize: 12 }}>{p.ordre_label || `Ord. ${p.ordre}`}</span>
                        </span>
                      </td>
                      <td className="muted-cell">{mat}</td>
                      <td><StatutBadge statut={p.statut} /></td>
                      <td className="mono-cell">{p.latitude_dd?.toFixed(5)}°</td>
                      <td className="mono-cell">{p.longitude_dd?.toFixed(5)}°</td>
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
