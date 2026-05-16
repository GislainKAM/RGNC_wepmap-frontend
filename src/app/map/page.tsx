'use client'

import React, { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { Header } from '@/components/layout/Header'
import { StatsStrip } from '@/components/layout/StatsStrip'
import { FiltersPanel } from '@/components/map/FiltersPanel'
import { PointFiche } from '@/components/map/PointFiche'
import { PointList } from '@/components/map/PointList'
import { Toaster, useToasts } from '@/components/ui/Toast'
import { usePointsGeoJSON, useStatsRGNC } from '@/hooks/useGeodeticPoints'
import { regionApi } from '@/lib/api'
import type { FiltresCarteState, Region } from '@/lib/types'
import { useQuery } from '@tanstack/react-query'

// SSR-safe MapCanvas (OpenLayers doesn't support SSR)
const MapCanvas = dynamic(
  () => import('@/components/map/MapCanvas').then((m) => m.MapCanvas),
  { ssr: false, loading: () => <div className="map-area" style={{ background: '#d4d0c8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5A6770', fontSize: 13 }}>Chargement de la carte…</div> }
)

const DEFAULT_FILTERS: FiltresCarteState = {
  statuts: [],
  ordres: [],
  regionId: null,
  departementId: null,
  communeId: null,
  reseau: null,
  recherche: '',
}

export default function MapPage() {
  const [view, setView]                 = useState<'map' | 'list'>('map')
  const [selectedId, setSelectedId]     = useState<number | null>(null)
  const [filtersCollapsed, setFiltersCollapsed] = useState(false)
  const [filters, setFilters]           = useState<FiltresCarteState>(DEFAULT_FILTERS)
  const { toasts, addToast, dismissToast } = useToasts()

  // Data
  const { data: geojson, isLoading: pointsLoading } = usePointsGeoJSON(filters)
  const { data: stats } = useStatsRGNC()

  // Regions for filter panel
  const { data: regions = [] } = useQuery<Region[]>({
    queryKey: ['regions'],
    queryFn: regionApi.list,
    staleTime: 60 * 60 * 1000,
  })

  const handleSearch = useCallback((q: string) => {
    setFilters((f) => ({ ...f, recherche: q }))
  }, [])

  const handleFiltersChange = useCallback((f: FiltresCarteState) => {
    setFilters(f)
  }, [])

  const handlePickPoint = useCallback((id: number) => {
    setSelectedId(id)
    if (view === 'list') {
      // stay in list; panel will open
    }
  }, [view])

  const visibleCount = geojson?.features?.length ?? 0

  return (
    <div className="app">
      <Header
        view={view}
        onViewChange={setView}
        onSearch={handleSearch}
        onToggleFilters={() => setFiltersCollapsed((c) => !c)}
        filtersCollapsed={filtersCollapsed}
      />
      <StatsStrip stats={stats ?? null} visibleCount={visibleCount} />

      <div className="main">
        {/* Filters sidebar */}
        <FiltersPanel
          filters={filters}
          onFiltersChange={handleFiltersChange}
          collapsed={filtersCollapsed}
          regions={regions}
          stats={stats ?? null}
          total={visibleCount}
        />

        {/* Content area */}
        {view === 'map' ? (
          <MapCanvas
            points={geojson ?? null}
            selectedId={selectedId}
            onPickPoint={handlePickPoint}
          />
        ) : (
          <PointList
            points={geojson?.features ?? []}
            onPickPoint={handlePickPoint}
            isLoading={pointsLoading}
          />
        )}

        {/* Point detail panel */}
        {selectedId !== null && (
          <PointFiche
            pointId={selectedId}
            onClose={() => setSelectedId(null)}
            onToast={addToast}
          />
        )}
      </div>

      <Toaster toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
