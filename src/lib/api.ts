/**
 * RGNC WebMap — Client API (Axios + TanStack Query)
 * Toutes les requêtes vers le backend GeoDjango passent par ici.
 */

import axios, { AxiosInstance, AxiosError } from 'axios'
import { API_URL, JWT_ACCESS_KEY, JWT_REFRESH_KEY } from './constants'
import type {
  Region, Departement, Commune,
  PointGeodesiqueLight, PointGeodesiqueDetail, FicheSignaletique,
  HistoriqueStatut, Signalement, ProfilUtilisateur, StatsRGNC,
  GeoJSONFeatureCollection, GeoJSONFeatureCollectionPaginated,
  PaginatedResponse, DemandeAcces, ImportResult,
  JWTTokens, FiltresCarteState, InscriptionFormData, ConnexionFormData,
} from './types'

// ═══════════════════════════════════════════════════════════════
// INSTANCE AXIOS
// ═══════════════════════════════════════════════════════════════

const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept':       'application/json',
  },
  timeout: 15000,
})

// ── Intercepteur requête : injecter le token JWT ─────────────────
apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem(JWT_ACCESS_KEY)
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

// ── Intercepteur réponse : refresh automatique du token ──────────
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as any

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      try {
        const refreshToken = localStorage.getItem(JWT_REFRESH_KEY)
        if (!refreshToken) throw new Error('No refresh token')

        const { data } = await axios.post<{ access: string }>(
          `${API_URL}/auth/token/refresh/`,
          { refresh: refreshToken }
        )
        localStorage.setItem(JWT_ACCESS_KEY, data.access)
        originalRequest.headers.Authorization = `Bearer ${data.access}`
        return apiClient(originalRequest)
      } catch {
        // Refresh échoué → déconnexion
        localStorage.removeItem(JWT_ACCESS_KEY)
        localStorage.removeItem(JWT_REFRESH_KEY)
        window.location.href = '/auth/login'
      }
    }
    return Promise.reject(error)
  }
)

// ═══════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════

/** Construit les query params depuis les filtres carte */
function buildFiltresParams(filtres: Partial<FiltresCarteState>): Record<string, string> {
  const params: Record<string, string> = {}
  if (filtres.statuts?.length)      params.statut__in  = filtres.statuts.join(',')
  if (filtres.ordres?.length)       params.ordre__in   = filtres.ordres.join(',')
  if (filtres.regionId)             params.region      = String(filtres.regionId)
  if (filtres.departementId)        params.departement = String(filtres.departementId)
  if (filtres.communeId)            params.commune     = String(filtres.communeId)
  if (filtres.reseau)               params.reseau      = filtres.reseau
  if (filtres.recherche?.trim())    params.search      = filtres.recherche.trim()
  return params
}

// ═══════════════════════════════════════════════════════════════
// API — DÉCOUPAGE ADMINISTRATIF
// ═══════════════════════════════════════════════════════════════

export const regionApi = {
  list: (): Promise<Region[]> =>
    apiClient.get('/regions/').then(r => {
      const d = r.data
      // Backend peut retourner un tableau direct ou une réponse paginée { results: [...] }
      return Array.isArray(d) ? d : (d.results ?? [])
    }),
}

export const departementApi = {
  list: (regionId?: number) =>
    apiClient
      .get<PaginatedResponse<Departement>>('/departements/', {
        params: regionId ? { region: regionId } : {},
      })
      .then(r => r.data.results),
}

export const communeApi = {
  list: (departementId?: number) =>
    apiClient
      .get<PaginatedResponse<Commune>>('/communes/', {
        params: departementId ? { departement: departementId } : {},
      })
      .then(r => r.data.results),
}

// ═══════════════════════════════════════════════════════════════
// API — POINTS GÉODÉSIQUES
// ═══════════════════════════════════════════════════════════════

export const pointApi = {
  /** GeoJSON complet pour OpenLayers (tous les points) */
  geojson: (filtres?: Partial<FiltresCarteState>) =>
    apiClient
      .get<GeoJSONFeatureCollection>('/points/', {
        params: buildFiltresParams(filtres ?? {}),
      })
      .then(r => r.data),

  /**
   * Liste paginée — retourne { count, results: [...objets plats] }
   * (transforme le GeoJSON FeatureCollection du backend en réponse standard
   *  afin que la table admin puisse lire data.results directement)
   */
  list: (filtres?: Partial<FiltresCarteState>, page = 1, pageSize = 25) =>
    apiClient
      .get<GeoJSONFeatureCollectionPaginated>('/points/', {
        params: { ...buildFiltresParams(filtres ?? {}), page, page_size: pageSize },
      })
      .then(r => {
        const d = r.data
        // Extraire les propriétés de chaque Feature GeoJSON → objet plat
        const results: PointGeodesiqueLight[] = (d.features ?? []).map(
          (f: GeoJSONFeatureCollection['features'][number] & { id?: number }) => {
            const props = (f.properties as unknown as Record<string, unknown>) ?? {}
            return {
              id: (f.id as number | undefined) ?? (props['id'] as number),
              ...props,
            } as unknown as PointGeodesiqueLight
          }
        )
        return {
          count:    d.count    ?? 0,
          next:     d.next     ?? null,
          previous: d.previous ?? null,
          results,
        }
      }),

  /** Détail d'un point par ID */
  detail: (id: number) =>
    apiClient.get<PointGeodesiqueDetail>(`/points/${id}/`).then(r => r.data),

  /** Fiche signalétique (métadonnées PDF) */
  fiche: (id: number) =>
    apiClient.get<FicheSignaletique>(`/points/${id}/fiche/`).then(r => r.data),

  /**
   * Télécharge le PDF de la fiche signalétique avec le token JWT.
   * Utilise fetch() pour envoyer l'header Authorization, puis retourne
   * une Blob URL à utiliser pour déclencher le téléchargement côté navigateur.
   * Retourne null si l'utilisateur n'a pas les droits (401/403).
   */
  telecharger: async (id: number, matricule: string): Promise<void> => {
    const token = localStorage.getItem(JWT_ACCESS_KEY)
    const response = await fetch(`${API_URL}/points/${id}/telecharger/`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err?.message ?? `Erreur ${response.status}`)
    }
    const blob     = await response.blob()
    const blobUrl  = URL.createObjectURL(blob)
    const anchor   = document.createElement('a')
    anchor.href     = blobUrl
    anchor.download = `Fiche_RGNC_${matricule}.pdf`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    // Libérer la mémoire après un court délai
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000)
  },

  /** Historique des statuts */
  historique: (id: number) =>
    apiClient.get<HistoriqueStatut[]>(`/points/${id}/historique/`).then(r => r.data),

  /** Soumettre un signalement (multipart si photo présente) */
  signaler: (id: number, data: { type_signalement: string; description: string; photo?: File | null }) => {
    const fd = new FormData()
    fd.append('type_signalement', data.type_signalement)
    fd.append('description',      data.description)
    if (data.photo) fd.append('photo', data.photo)
    return apiClient
      .post<Signalement>(`/points/${id}/signaler/`, fd)
      .then(r => r.data)
  },

  /** Statistiques globales */
  stats: () =>
    apiClient.get<StatsRGNC>('/points/stats/').then(r => r.data),

  /** CRUD admin */
  create: (data: Partial<PointGeodesiqueDetail>) =>
    apiClient.post('/points/', data).then(r => r.data),
  update: (id: number, data: Partial<PointGeodesiqueDetail>) =>
    apiClient.patch(`/points/${id}/`, data).then(r => r.data),
  delete: (id: number) =>
    apiClient.delete(`/points/${id}/`),

  /** Upload photo terrain d'une borne (multipart) */
  uploadPhoto: (id: number, file: File): Promise<PointGeodesiqueDetail> => {
    const form = new FormData()
    form.append('photo', file)
    return apiClient
      .patch<PointGeodesiqueDetail>(`/points/${id}/`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then(r => r.data)
  },

  /** Suppression de la photo terrain */
  deletePhoto: (id: number): Promise<PointGeodesiqueDetail> =>
    apiClient.patch<PointGeodesiqueDetail>(`/points/${id}/`, { photo: null }).then(r => r.data),
}

// ═══════════════════════════════════════════════════════════════
// API — AUTH
// ═══════════════════════════════════════════════════════════════

export const authApi = {
  /** Connexion — retourne les tokens JWT */
  login: async (data: ConnexionFormData): Promise<JWTTokens> => {
    const response = await apiClient.post<JWTTokens>('/auth/token/', data)
    const tokens   = response.data
    localStorage.setItem(JWT_ACCESS_KEY, tokens.access)
    localStorage.setItem(JWT_REFRESH_KEY, tokens.refresh)
    return tokens
  },

  /** Inscription d'un nouveau géomètre */
  register: (data: InscriptionFormData) =>
    apiClient.post('/inscription/', data).then(r => r.data),

  /** Déconnexion locale */
  logout: () => {
    localStorage.removeItem(JWT_ACCESS_KEY)
    localStorage.removeItem(JWT_REFRESH_KEY)
  },

  /** Vérifie si un token est encore valide */
  verify: (token: string) =>
    apiClient.post('/auth/token/verify/', { token }).then(r => r.data),
}

// ═══════════════════════════════════════════════════════════════
// API — PROFIL UTILISATEUR
// ═══════════════════════════════════════════════════════════════

export const profilApi = {
  get: () =>
    apiClient.get<ProfilUtilisateur>('/profil/').then(r => r.data),

  update: (data: Partial<ProfilUtilisateur>) =>
    apiClient.patch<ProfilUtilisateur>('/profil/', data).then(r => r.data),

  /** Upload de la photo de profil (multipart) — endpoint PATCH /profil/ avec FormData */
  uploadPhoto: (file: File): Promise<ProfilUtilisateur> => {
    const form = new FormData()
    form.append('photo', file)
    return apiClient
      .patch<ProfilUtilisateur>('/profil/', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then(r => r.data)
  },

  /** Suppression de la photo de profil */
  deletePhoto: (): Promise<ProfilUtilisateur> =>
    apiClient
      .patch<ProfilUtilisateur>('/profil/', { photo: null })
      .then(r => r.data),
}

// ═══════════════════════════════════════════════════════════════
// API — SIGNALEMENTS (admin)
// ═══════════════════════════════════════════════════════════════

export const signalementApi = {
  /** Liste paginée des signalements */
  list: (params?: { statut?: string; search?: string; page?: number; page_size?: number }) =>
    apiClient
      .get<PaginatedResponse<Signalement>>('/signalements/', { params })
      .then(r => r.data),

  /** Modifier le statut / assigner un agent */
  update: (id: number, data: Partial<Signalement>) =>
    apiClient.patch<Signalement>(`/signalements/${id}/`, data).then(r => r.data),
}

// ═══════════════════════════════════════════════════════════════
// API — UTILISATEURS / AGENTS (admin)
// ═══════════════════════════════════════════════════════════════

export const utilisateurApi = {
  /** Liste des utilisateurs — filtrables par rôle */
  list: (params?: { role?: string; search?: string; page?: number }) =>
    apiClient
      .get<PaginatedResponse<ProfilUtilisateur>>('/utilisateurs/', { params })
      .then(r => r.data),

  /** Modifier le rôle ou le statut d'un utilisateur */
  update: (id: number, data: Partial<ProfilUtilisateur>) =>
    apiClient.patch<ProfilUtilisateur>(`/utilisateurs/${id}/`, data).then(r => r.data),

  /** Inviter un nouvel agent par email */
  invite: (data: { email: string; role: string; message?: string }) =>
    apiClient.post('/utilisateurs/inviter/', data).then(r => r.data),
}

// ═══════════════════════════════════════════════════════════════
// API — DEMANDES D'ACCÈS (admin)
// ═══════════════════════════════════════════════════════════════

export const demandeApi = {
  /** Liste des demandes — filtrables par statut */
  list: (params?: { statut?: string }) =>
    apiClient
      .get<PaginatedResponse<DemandeAcces>>('/demandes-acces/', { params })
      .then(r => r.data),

  /** Approuver une demande (envoie email automatique côté backend) */
  approve: (id: number) =>
    apiClient.post<DemandeAcces>(`/demandes-acces/${id}/approuver/`).then(r => r.data),

  /** Rejeter une demande */
  reject: (id: number) =>
    apiClient.post<DemandeAcces>(`/demandes-acces/${id}/rejeter/`).then(r => r.data),
}

// ═══════════════════════════════════════════════════════════════
// API — IMPORT DE DONNÉES (admin)
// ═══════════════════════════════════════════════════════════════

export const importApi = {
  /** Upload d'un fichier CSV / GeoJSON / PDF et retour du rapport */
  upload: (file: File): Promise<ImportResult> => {
    const form = new FormData()
    form.append('fichier', file)
    return apiClient
      .post<ImportResult>('/points/importer/', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,    // 60 s — l'OCR peut prendre du temps
      })
      .then(r => r.data)
  },

  /** Télécharger le modèle CSV MINDCAF */
  telechargerModele: () =>
    apiClient.get('/points/modele-csv/', { responseType: 'blob' }).then(r => r.data),
}

// Export de l'instance pour usage direct si besoin
export default apiClient
