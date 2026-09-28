'use client'

import React, { useState, useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { StatsStrip } from '@/components/layout/StatsStrip'
import { FiltersPanel } from '@/components/map/FiltersPanel'
import { PointFiche } from '@/components/map/PointFiche'
import { PointList } from '@/components/map/PointList'
import { Toaster, useToasts } from '@/components/ui/Toast'
import { SkipLink, ANCRE_CONTENU } from '@/components/ui/SkipLink'
import { usePointsGeoJSON, useStatsRGNC, useZoneInteret } from '@/hooks/useGeodeticPoints'
import { useAuth } from '@/hooks/useAuth'
import { regionApi } from '@/lib/api'
import { ROUTES } from '@/lib/constants'
import type { FiltresCarteState, Region } from '@/lib/types'
import { useQuery } from '@tanstack/react-query'

/** Lien de connexion vers un point donné, pour y revenir après authentification. */
const lienConnexionPourPoint = (id: number) =>
  `${ROUTES.LOGIN}?next=${encodeURIComponent(`/map?point=${id}`)}`

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
  const router = useRouter()
  const isAuth = useAuth((s) => s.isAuthenticated)
  const [view, setView]                 = useState<'map' | 'list'>('map')
  const [selectedId, setSelectedId]     = useState<number | null>(null)
  // Commence à false (identique serveur/client pour éviter l'erreur d'hydratation).
  // Après montage, on ferme automatiquement sur mobile.
  const [filtersCollapsed, setFiltersCollapsed] = useState(false)

  useEffect(() => {
    if (window.innerWidth < 768) setFiltersCollapsed(true)
  }, [])

  // Lien « Partager » d'une fiche : /map?point=<id>. Le détail d'un point
  // exige un compte — sans connexion, direction la page de connexion, avec
  // un retour automatique vers ce même point une fois authentifié.
  useEffect(() => {
    const pointPartage = Number(new URLSearchParams(window.location.search).get('point'))
    if (!Number.isInteger(pointPartage) || pointPartage <= 0) return
    if (isAuth) setSelectedId(pointPartage)
    else router.replace(lienConnexionPourPoint(pointPartage))
  }, [isAuth, router])

  const [filters, setFilters]           = useState<FiltresCarteState>(DEFAULT_FILTERS)
  const { toasts, addToast, dismissToast } = useToasts()

  // Data
  const { data: geojson, isLoading: pointsLoading } = usePointsGeoJSON(filters)
  const { data: stats } = useStatsRGNC()
  // Emprise mise en évidence sur la carte — Cameroun tant qu'aucun filtre
  // administratif n'est posé, sinon la région, le département ou
  // l'arrondissement sélectionné.
  const { data: zone } = useZoneInteret(filters)

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
    if (!isAuth) { router.push(lienConnexionPourPoint(id)); return }
    setSelectedId(id)
  }, [isAuth, router])

  const visibleCount = geojson?.features?.length ?? 0

  /**
   * Nombre de critères actifs, affiché en pastille sur le bouton Filtres.
   *
   * Sur mobile le panneau est fermé par défaut : sans ce compteur, rien
   * n'indique qu'un filtre restreint l'affichage, et une carte presque vide
   * passe pour un défaut de chargement. La recherche est comptée aussi — le
   * champ du header est réduit à une icône sur mobile, donc invisible.
   */
  const nbFiltresActifs =
    (filters.statuts.length      ? 1 : 0) +
    (filters.ordres.length       ? 1 : 0) +
    (filters.regionId            ? 1 : 0) +
    (filters.departementId       ? 1 : 0) +
    (filters.communeId           ? 1 : 0) +
    (filters.reseau              ? 1 : 0) +
    (filters.recherche.trim()    ? 1 : 0)

  return (
    <div className="app">
      <SkipLink />
      <Header
        view={view}
        onViewChange={setView}
        onSearch={handleSearch}
        onToggleFilters={() => setFiltersCollapsed((c) => !c)}
        filtersCollapsed={filtersCollapsed}
      />
      <StatsStrip stats={stats ?? null} visibleCount={visibleCount} zone={zone ?? null} />

      <div className="main" id={ANCRE_CONTENU} tabIndex={-1}>
        {/* Filters sidebar */}
        <FiltersPanel
          filters={filters}
          onFiltersChange={handleFiltersChange}
          collapsed={filtersCollapsed}
          onClose={() => setFiltersCollapsed(true)}
          regions={regions}
          stats={stats ?? null}
          geojson={geojson ?? null}
          total={visibleCount}
        />

        {/* Content area */}
        {view === 'map' ? (
          <MapCanvas
            points={geojson ?? null}
            selectedId={selectedId}
            onPickPoint={handlePickPoint}
            zone={zone ?? null}
            onBasculerFiltres={() => setFiltersCollapsed((c) => !c)}
            filtresOuverts={!filtersCollapsed}
            nbFiltresActifs={nbFiltresActifs}
          />
        ) : (
          <PointList
            points={geojson?.features ?? []}
            onPickPoint={handlePickPoint}
            isLoading={pointsLoading}
            onBasculerFiltres={() => setFiltersCollapsed((c) => !c)}
            nbFiltresActifs={nbFiltresActifs}
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
