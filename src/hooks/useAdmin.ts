/**
 * RGNC WebMap — Hooks admin (TanStack Query)
 * Données réelles depuis le backend Django — sections admin seulement.
 */
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  pointApi, signalementApi, utilisateurApi, demandeApi, importApi,
} from '@/lib/api'
import type {
  PointGeodesiqueDetail, Signalement, ProfilUtilisateur, FiltresCarteState,
} from '@/lib/types'

// ── Clés de cache ─────────────────────────────────────────────────

export const ADMIN_KEYS = {
  bornes:      (p: Record<string, unknown>) => ['admin', 'bornes', p],
  borneDetail: (id: number)                 => ['admin', 'bornes', id],
  signalements:(p: Record<string, unknown>) => ['admin', 'signalements', p],
  users:       (p: Record<string, unknown>) => ['admin', 'users', p],
  demandes:    (p: Record<string, unknown>) => ['admin', 'demandes', p],
} as const

// ═══════════════════════════════════════════════════════════════
// BORNES — list + detail + mutations
// ═══════════════════════════════════════════════════════════════

/** Liste paginée des bornes pour le tableau admin */
export function useAdminBornes(
  filtres: Partial<FiltresCarteState> = {},
  page = 1,
  pageSize = 25,
) {
  return useQuery({
    queryKey: ADMIN_KEYS.bornes({ ...filtres, page, pageSize }),
    queryFn:  () => pointApi.list(filtres, page, pageSize),  // pageSize transmis à l'API
    staleTime: 60 * 1000,    // 1 min
    gcTime:    5 * 60 * 1000,
    placeholderData: (prev) => prev,
  })
}

/** Détail complet d'une borne pour le formulaire d'édition */
export function useAdminBorneDetail(id: number | null) {
  return useQuery({
    queryKey: ADMIN_KEYS.borneDetail(id!),
    queryFn:  () => pointApi.detail(id!),
    enabled:  id !== null,
    staleTime: 5 * 60 * 1000,
    gcTime:   10 * 60 * 1000,
  })
}

/** Créer une borne */
export function useCreateBorne() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<PointGeodesiqueDetail>) => pointApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'bornes'] })
      qc.invalidateQueries({ queryKey: ['points', 'stats'] })
    },
  })
}

/** Modifier une borne */
export function useUpdateBorne() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<PointGeodesiqueDetail> }) =>
      pointApi.update(id, data),
    onSuccess: (_result, { id }) => {
      qc.invalidateQueries({ queryKey: ['admin', 'bornes'] })
      qc.invalidateQueries({ queryKey: ADMIN_KEYS.borneDetail(id) })
      qc.invalidateQueries({ queryKey: ['points', id] })
    },
  })
}

/** Supprimer une ou plusieurs bornes */
export function useDeleteBornes() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: number[]) =>
      Promise.all(ids.map((id) => pointApi.delete(id))),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'bornes'] })
      qc.invalidateQueries({ queryKey: ['points', 'stats'] })
    },
  })
}

// ═══════════════════════════════════════════════════════════════
// SIGNALEMENTS — list + mutation statut
// ═══════════════════════════════════════════════════════════════

/** Liste des signalements avec filtre optionnel */
export function useSignalements(params: { statut?: string; page?: number } = {}) {
  return useQuery({
    queryKey:  ADMIN_KEYS.signalements(params),
    queryFn:   () => signalementApi.list({ ...params, page_size: 50 }),
    staleTime: 30 * 1000,
    gcTime:    5 * 60 * 1000,
    // Polling uniquement quand la fenêtre est active (évite les requêtes en arrière-plan)
    refetchInterval: (query) =>
      query.state.status === 'success' && document.visibilityState === 'visible'
        ? 60 * 1000
        : false,
    refetchIntervalInBackground: false,
  })
}

/** Changer le statut d'un signalement (kanban) */
export function useUpdateSignalement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Signalement> }) =>
      signalementApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'signalements'] })
    },
  })
}

// ═══════════════════════════════════════════════════════════════
// UTILISATEURS / AGENTS — list + mutation
// ═══════════════════════════════════════════════════════════════

/** Liste des utilisateurs (filtrable par rôle) */
export function useAdminUsers(params: { role?: string; search?: string; page?: number } = {}) {
  return useQuery({
    queryKey:  ADMIN_KEYS.users(params),
    queryFn:   () => utilisateurApi.list(params),
    staleTime: 2 * 60 * 1000,
  })
}

/** Modifier un utilisateur (rôle, est_verifie, peut_telecharger…) */
export function useUpdateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ProfilUtilisateur> }) =>
      utilisateurApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
  })
}

/** Inviter un agent par email */
export function useInviteAgent() {
  return useMutation({
    mutationFn: (data: { email: string; role: string; message?: string }) =>
      utilisateurApi.invite(data),
  })
}

// ═══════════════════════════════════════════════════════════════
// DEMANDES D'ACCÈS — list + approve + reject
// ═══════════════════════════════════════════════════════════════

/** Liste des demandes en attente */
export function useDemandes(params: { statut?: string } = { statut: 'attente' }) {
  return useQuery({
    queryKey:  ADMIN_KEYS.demandes(params),
    queryFn:   () => demandeApi.list(params),
    staleTime: 30 * 1000,
    gcTime:    5 * 60 * 1000,
    // Polling uniquement quand la fenêtre est active
    refetchInterval: (query) =>
      query.state.status === 'success' && document.visibilityState === 'visible'
        ? 2 * 60 * 1000
        : false,
    refetchIntervalInBackground: false,
  })
}

/** Approuver une demande d'accès */
export function useApproveDemande() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => demandeApi.approve(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'demandes'] })
      qc.invalidateQueries({ queryKey: ['admin', 'users'] })
    },
  })
}

/** Rejeter une demande d'accès */
export function useRejectDemande() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => demandeApi.reject(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'demandes'] })
    },
  })
}

// ═══════════════════════════════════════════════════════════════
// IMPORT — upload fichier
// ═══════════════════════════════════════════════════════════════

/** Upload d'un fichier d'import → rapport */
export function useImportBornes() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => importApi.upload(file),
    onSuccess: () => {
      // Invalider la liste et les stats après un import réussi
      qc.invalidateQueries({ queryKey: ['admin', 'bornes'] })
      qc.invalidateQueries({ queryKey: ['points', 'stats'] })
    },
  })
}
