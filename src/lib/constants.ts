/**
 * RGNC WebMap — Constantes & Configuration
 */

// ── API ──────────────────────────────────────────────────────────
export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'
export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'RGNC WebMap'

// ── Géographie Cameroun ──────────────────────────────────────────
/** Étendue géographique (bbox) du Cameroun en WGS84 */
export const CAMEROON_BBOX = {
  minLon: 8.3,
  minLat: 1.6,
  maxLon: 16.2,
  maxLat: 13.1,
} as const

/** Centre géographique approximatif du Cameroun */
export const CAMEROON_CENTER: [number, number] = [12.35, 5.87]   // [lon, lat]

/** Zoom par défaut pour la carte */
export const DEFAULT_ZOOM     = 6
export const MIN_ZOOM         = 5
export const MAX_ZOOM         = 20
export const CLUSTER_DISTANCE = 40   // pixels pour le clustering

// ── Couleurs des statuts (cohérence Design System) ───────────────
export const STATUT_COLORS = {
  actif:   '#16a34a',   // vert
  degrade: '#ea580c',   // orange
  detruit: '#dc2626',   // rouge
  inconnu: '#6b7280',   // gris
} as const

export const STATUT_LABELS = {
  actif:   'Actif',
  degrade: 'Dégradé',
  detruit: 'Détruit',
  inconnu: 'Inconnu',
} as const

// ── Couleurs des ordres ──────────────────────────────────────────
export const ORDRE_COLORS = {
  1: '#1d4ed8',   // bleu foncé — 1er ordre
  2: '#7c3aed',   // violet — 2ème ordre
  3: '#0891b2',   // cyan — 3ème ordre
} as const

export const ORDRE_LABELS = {
  1: '1er ordre — Référence',
  2: '2ème ordre — Base',
  3: '3ème ordre — Densification',
} as const

// ── Réseaux / Campagnes ──────────────────────────────────────────
export const RESEAU_LABELS = {
  PAMOCCA:     'PAMOCCA 2011',
  DENSIF_2018: 'Densification 2018',
  DENSIF_2019: 'Densification 2019',
  DENSIF_2021: 'Densification 2021',
  DENSIF_2025: 'Densification 2025',
  AUTRE:       'Autre',
} as const

// ── Régions du Cameroun ──────────────────────────────────────────
export const REGIONS_CM = [
  { code: 'AD', nom: 'Adamaoua' },
  { code: 'CE', nom: 'Centre' },
  { code: 'ES', nom: 'Est' },
  { code: 'EN', nom: 'Extrême-Nord' },
  { code: 'LT', nom: 'Littoral' },
  { code: 'NO', nom: 'Nord' },
  { code: 'NW', nom: 'Nord-Ouest' },
  { code: 'OU', nom: 'Ouest' },
  { code: 'SU', nom: 'Sud' },
  { code: 'SW', nom: 'Sud-Ouest' },
] as const

// ── Pagination ───────────────────────────────────────────────────
export const PAGE_SIZE          = 50
export const LIST_PAGE_SIZE     = 20   // Liste dans la sidebar

// ── JWT (localStorage keys) ──────────────────────────────────────
export const JWT_ACCESS_KEY     = 'rgnc_access_token'
export const JWT_REFRESH_KEY    = 'rgnc_refresh_token'

// ── Routes frontend ──────────────────────────────────────────────
export const ROUTES = {
  HOME:     '/',
  MAP:      '/map',
  LOGIN:    '/auth/login',
  REGISTER: '/auth/register',
  PROFILE:  '/profil',
  ADMIN:    '/admin',
  POINT:    (id: number | string) => `/points/${id}`,
} as const
