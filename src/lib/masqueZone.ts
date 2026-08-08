/**
 * RGNC WebMap — Découpe du masque de la zone d'intérêt
 *
 * Construit les anneaux à donner à OpenLayers pour assombrir tout ce qui est
 * hors de la zone observée. Séparé du composant carte pour rester testable
 * sans navigateur ni instance OpenLayers.
 */

import type { ZoneInteret } from './types'

/** Un anneau : suite de couples [longitude, latitude] en degrés WGS84. */
type Anneau = number[][]

/**
 * Emprise du masque, en degrés.
 *
 * Volontairement plus large que le monde réel (±180 / ±90) : la projection
 * Web Mercator est cyclique en longitude, et un utilisateur qui fait défiler
 * la carte vers l'est sort de la copie centrale du monde. Sans cette marge,
 * il verrait le masque s'arrêter net sur une bordure verticale.
 *
 * La latitude est bornée à ±85° parce que Web Mercator diverge aux pôles :
 * 90° s'y projette à l'infini.
 */
const MONDE: Anneau = [
  [-540, -85], [540, -85], [540, 85], [-540, 85], [-540, -85],
]

export interface DecoupeMasque {
  /**
   * Anneaux du polygone de masque : le premier est l'emprise du monde, les
   * suivants sont les contours extérieurs de la zone, qui y percent autant
   * de fenêtres. C'est la convention GeoJSON : premier anneau = extérieur,
   * suivants = trous.
   */
  masque: Anneau[]
  /**
   * Anneaux intérieurs de la zone — ses enclaves. Ils sont géographiquement
   * hors de la zone et doivent donc rester assombris, alors que la fenêtre
   * percée à l'étape précédente les a rendus clairs. On les redessine en
   * polygones sombres distincts.
   *
   * Le cas n'est pas théorique : le découpage administratif camerounais
   * compte 6 enclaves au niveau régional.
   */
  enclaves: Anneau[]
  /** Contours extérieurs seuls, pour tracer la limite de la zone. */
  contours: Anneau[]
}

/**
 * Sépare les anneaux d'une zone en trois jeux exploitables par OpenLayers.
 *
 * Retourne `null` si la géométrie est vide ou d'un type inattendu : l'appelant
 * doit alors n'afficher aucun masque, plutôt qu'un écran entièrement sombre.
 */
export function decouperMasque(zone: ZoneInteret | null | undefined): DecoupeMasque | null {
  if (!zone?.geometry) return null

  const { type, coordinates } = zone.geometry

  // Un Polygon est traité comme un MultiPolygon d'un seul élément, ce qui
  // évite de dupliquer la boucle qui suit.
  let polygones: Anneau[][]
  if (type === 'Polygon') {
    polygones = [coordinates as Anneau[]]
  } else if (type === 'MultiPolygon') {
    polygones = coordinates as Anneau[][]
  } else {
    return null
  }

  const contours: Anneau[] = []
  const enclaves: Anneau[] = []

  for (const anneaux of polygones) {
    if (!anneaux?.length) continue
    contours.push(anneaux[0])
    for (let i = 1; i < anneaux.length; i++) enclaves.push(anneaux[i])
  }

  if (!contours.length) return null

  return { masque: [MONDE, ...contours], enclaves, contours }
}
