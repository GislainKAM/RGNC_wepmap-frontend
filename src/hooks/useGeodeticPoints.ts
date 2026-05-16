/**
 * RGNC WebMap — Hook : points géodésiques (TanStack Query)
 * Gère le fetching, le cache et les filtres de la carte.
 */
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { pointApi } from '@/lib/api'
import type { FiltresCarteState, PointGeodesiqueDetail } from '@/lib/types'

// Clés de cache Query
export const QUERY_KEYS = {
  points:     (filtres: Partial<FiltresCarteState>) => ['points', filtres],
  geojson:    (filtres: Partial<FiltresCarteState>) => ['points', 'geojson', filtres],
  detail:     (id: number) => ['points', id],
  fiche:      (id: number) => ['points', id, 'fiche'],
  historique: (id: number) => ['points', id, 'historique'],
  stats:      () => ['points', 'stats'],
} as const

/** GeoJSON pour OpenLayers — mis en cache 5 minutes */
export function usePointsGeoJSON(filtres: Partial<FiltresCarteState> = {}) {
  return useQuery({
    queryKey:  QUERY_KEYS.geojson(filtres),
    queryFn:   () => pointApi.geojson(filtres),
    staleTime: 5 * 60 * 1000,    // 5 min
    retry:     2,
  })
}

/** Liste paginée pour la sidebar */
export function usePointsList(filtres: Partial<FiltresCarteState> = {}, page = 1) {
  return useQuery({
    queryKey: QUERY_KEYS.points(filtres),
    queryFn:  () => pointApi.list(filtres, page),
    staleTime: 2 * 60 * 1000,
  })
}

/** Détail d'un point sélectionné */
export function usePointDetail(id: number | null) {
  return useQuery({
    queryKey: QUERY_KEYS.detail(id!),
    queryFn:  () => pointApi.detail(id!),
    enabled:  id !== null,
    staleTime: 10 * 60 * 1000,
  })
}

/** Fiche signalétique (métadonnées PDF) */
export function useFicheSignaletique(pointId: number | null) {
  return useQuery({
    queryKey: QUERY_KEYS.fiche(pointId!),
    queryFn:  () => pointApi.fiche(pointId!),
    enabled:  pointId !== null,
  })
}

/** Historique des statuts */
export function useHistoriqueStatuts(pointId: number | null) {
  return useQuery({
    queryKey: QUERY_KEYS.historique(pointId!),
    queryFn:  () => pointApi.historique(pointId!),
    enabled:  pointId !== null,
  })
}

/** Stats globales (dashboard) */
export function useStatsRGNC() {
  return useQuery({
    queryKey:  QUERY_KEYS.stats(),
    queryFn:   () => pointApi.stats(),
    staleTime: 15 * 60 * 1000,   // 15 min
  })
}

/** Mutation : signaler un problème sur une borne */
export function useSignalerBorne(pointId: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Parameters<typeof pointApi.signaler>[1]) =>
      pointApi.signaler(pointId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.detail(pointId) })
    },
  })
}
