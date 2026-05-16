/**
 * RGNC WebMap — Types TypeScript partagés
 * Miroir des modèles GeoDjango côté frontend
 */

// ═══════════════════════════════════════════════════════════════
// ENTITÉS MÉTIER
// ═══════════════════════════════════════════════════════════════

export type StatutBorne = 'actif' | 'degrade' | 'detruit' | 'inconnu'
export type OrdreBorne  = 1 | 2 | 3
export type ReseauBorne = 'PAMOCCA' | 'DENSIF_2018' | 'DENSIF_2019' | 'DENSIF_2021' | 'DENSIF_2025' | 'AUTRE'
export type RoleUtilisateur = 'visiteur' | 'geometre' | 'admin'
export type FormatExport = 'pdf' | 'json' | 'csv'

// ─── Région ─────────────────────────────────────────────────────
export interface Region {
  id:   number
  code: string    // ex: "CE", "LT"
  nom:  string    // ex: "Centre", "Littoral"
}

// ─── Département ────────────────────────────────────────────────
export interface Departement {
  id:          number
  nom:         string
  region:      number
  region_nom:  string
}

// ─── Commune ────────────────────────────────────────────────────
export interface Commune {
  id:              number
  nom:             string
  departement:     number
  departement_nom: string
  region_nom:      string
}

// ─── Point Géodésique (version allégée pour carte) ──────────────
// Correspond à PointGeodesiqueLightSerializer (GeoFeatureModelSerializer)
// Les propriétés sont dans feature.properties, pas à la racine.
export interface PointGeodesiqueLight {
  id:          number
  matricule:   string           // ex: "B441"
  code_projet: string           // ex: "Bafouusam_Densif"
  nom:         string
  ordre:       OrdreBorne
  statut:      StatutBorne
  region_nom:  string | null    // null si pas de région associée
  commune_nom: string | null    // null si pas de commune associée
  localite:    string
  latitude_dd:  number
  longitude_dd: number
}

// ─── Point Géodésique (version détail) ──────────────────────────
export interface PointGeodesiqueDetail {
  id:                 number
  matricule:          string
  code_projet:        string
  nom:                string
  // Coordonnées
  latitude_dd:        number
  longitude_dd:       number
  latitude_dms:       string    // ex: "3°52'14.23"N"
  longitude_dms:      string
  easting_utm:        number | null
  northing_utm:       number | null
  zone_utm:           string    // "32N" ou "33N"
  altitude_ngac:      number | null
  altitude_ellipsoidale: number | null
  ondulation_geoidale:   number | null
  // Référentiel
  systeme_reference:  string
  epsg_code:          number
  // Réseau
  ordre:              OrdreBorne
  ordre_label:        string
  reseau:             ReseauBorne
  reseau_label:       string
  // Localisation administrative (null si non renseignée)
  region_nom:         string | null
  region_code:        string | null
  departement_nom:    string | null
  commune_nom:        string | null
  localite:           string
  // Statut
  statut:             StatutBorne
  statut_label:       string
  date_verification:  string | null    // ISO date
  // Description
  description_acces:  string
  description_borne:  string
  photo_url:          string | null    // URL absolue (jamais chemin disque brut)
  // Calculés
  a_fiche_pdf:        boolean
  nb_telechargements: number
  // Métadonnées
  date_creation:      string           // ISO datetime
  date_modification:  string
}

// ─── Fiche Signalétique ──────────────────────────────────────────
// Note : fichier_pdf et url_pdf sont intentionnellement absents.
// Le téléchargement se fait uniquement via GET /api/points/{id}/telecharger/
export interface FicheSignaletique {
  id:              number
  point:           number
  point_matricule: string
  taille_ko:       number
  version:         number
  date_upload:     string
}

// ─── Historique Statut ───────────────────────────────────────────
export interface HistoriqueStatut {
  id:              number
  statut:          StatutBorne
  statut_label:    string
  date:            string
  notes:           string
  verifie_par_nom: string | null
  date_saisie:     string
}

// ─── Signalement ─────────────────────────────────────────────────
export interface Signalement {
  id:                      number
  point:                   number
  point_matricule:         string
  type_signalement:        string
  type_label:              string
  description:             string
  photo:                   string | null
  reporter_nom:            string | null
  date_signalement:        string
  statut_traitement:       string
  statut_traitement_label: string
}

// ─── Demande d'accès ─────────────────────────────────────────────
export interface DemandeAcces {
  id:              number
  utilisateur:     number | null
  nom_complet:     string
  email:           string
  organisation:    string
  fonction:        string
  region_nom:      string
  justification:   string
  date_demande:    string
  statut:          'attente' | 'approuvee' | 'rejetee'
  traite_par_nom:  string | null
  date_traitement: string | null
  notes_admin:     string
}

// ─── Résultat d'import ────────────────────────────────────────────
export interface ImportResult {
  importees: number
  doublons:  number
  erreurs:   number
  details:   Array<{
    id:       string
    nom:      string
    statut:   'ok' | 'doublon' | 'erreur'
    message?: string
  }>
}

// ─── Profil Utilisateur ──────────────────────────────────────────
export interface ProfilUtilisateur {
  id:               number
  username:         string
  email:            string
  nom_complet:      string
  first_name:       string
  last_name:        string
  role:             RoleUtilisateur
  role_label:       string
  organisation:     string
  numero_ordre:     string
  telephone:        string
  region_principale: number | null   // ID FK
  region_nom:       string | null    // null si pas de région
  est_verifie:      boolean
  peut_telecharger: boolean
  date_inscription: string
  photo_url:        string | null    // URL absolue de la photo de profil (null si aucune)
}

// ═══════════════════════════════════════════════════════════════
// API RESPONSES
// ═══════════════════════════════════════════════════════════════

export interface PaginatedResponse<T> {
  count:    number
  next:     string | null
  previous: string | null
  results:  T[]
}

// GeoJSON FeatureCollection simple (sans pagination)
export interface GeoJSONFeatureCollection<P = PointGeodesiqueLight> {
  type:     'FeatureCollection'
  features: GeoJSONFeature<P>[]
}

// GeoJSON FeatureCollection paginée — retournée par GeoJsonPagination de DRF
// (utilisée par GET /points/ avec page/page_size)
export interface GeoJSONFeatureCollectionPaginated<P = PointGeodesiqueLight> {
  type:     'FeatureCollection'
  count:    number
  next:     string | null
  previous: string | null
  features: GeoJSONFeature<P>[]
}

export interface GeoJSONFeature<P = PointGeodesiqueLight> {
  type:       'Feature'
  id:         number
  geometry:   GeoJSONPoint
  properties: P
}

export interface GeoJSONPoint {
  type:        'Point'
  coordinates: [number, number]    // [longitude, latitude]
}

// ─── Statistiques ────────────────────────────────────────────────
export interface StatsRGNC {
  total_points:       number
  par_statut:         Array<{ statut: StatutBorne; nb: number }>
  par_ordre:          Array<{ ordre: OrdreBorne; nb: number }>
  par_region:         Array<{ region__nom: string | null; region__code: string | null; nb: number }>
  par_region_ordre:   Array<{ region__code: string | null; ordre: OrdreBorne; nb: number }>
  nb_fiches_pdf:      number
  nb_telechargements: number
}

// ═══════════════════════════════════════════════════════════════
// FORMS & FILTERS
// ═══════════════════════════════════════════════════════════════

export interface FiltresCarteState {
  statuts:      StatutBorne[]
  ordres:       OrdreBorne[]
  regionId:     number | null
  departementId: number | null
  communeId:    number | null
  reseau:       ReseauBorne | null
  recherche:    string
}

export interface InscriptionFormData {
  // Étape 1
  username:   string
  email:      string
  password:   string
  first_name: string
  last_name:  string
  // Étape 2
  organisation:     string
  numero_ordre:     string
  telephone:        string
  region_principale: number | null
}

export interface ConnexionFormData {
  username: string
  password: string
}

// ─── JWT Tokens ──────────────────────────────────────────────────
export interface JWTTokens {
  access:  string
  refresh: string
}

export interface JWTPayload {
  user_id:  number
  username: string
  exp:      number
  iat:      number
}
