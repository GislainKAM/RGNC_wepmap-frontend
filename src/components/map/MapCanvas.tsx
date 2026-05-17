'use client'

import React, { useRef, useEffect, useCallback, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { OrdreIcon } from '@/components/ui/OrdreIcon'
import { useLanguage } from '@/hooks/useLanguage'
import type { GeoJSONFeatureCollection } from '@/lib/types'
import { CAMEROON_CENTER, DEFAULT_ZOOM, MIN_ZOOM, MAX_ZOOM } from '@/lib/constants'

// ── Types ────────────────────────────────────────────────────────

interface MapCanvasProps {
  points:      GeoJSONFeatureCollection | null
  selectedId:  number | null
  onPickPoint: (id: number) => void
}

type Tool    = 'pan' | 'measure'
type Basemap = 'osm' | 'google-maps' | 'google-hybrid' | 'satellite'

// ── Constants ────────────────────────────────────────────────────

const STATUT_COLORS: Record<string, string> = {
  actif:   '#1F5D3A',
  degrade: '#D4A017',
  detruit: '#B83434',
  inconnu: '#9BA5AC',
}
// ── Moteur de clustering par groupe (ordre + statut) ─────────────
//
// `ol/source/Cluster` ne filtre pas par attribut — on l'implémente manuellement.
// Algorithme : greedy centroïde glissant, O(N × K) par groupe.
//
// rawFeatures   : features OL brutes (EPSG:3857)
// resolution    : mètres / pixel à l'échelle actuelle  (view.getResolution())
// pixelDistance : seuil de regroupement en pixels (ex : 40)
// OlFeature / OlPoint : classes OL passées en paramètre

function buildDisplayFeatures(
  rawFeatures: any[],
  resolution: number,
  pixelDistance: number,
  OlFeature: any,
  OlPoint: any,
): any[] {
  // 1. Regrouper par (ordre, statut) — on ne cluster que les « mêmes » points
  const groups = new Map<string, any[]>()
  for (const f of rawFeatures) {
    const p   = f.getProperties()
    const key = `${p.ordre ?? 3}__${p.statut ?? 'inconnu'}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(f)
  }

  const meterDist = pixelDistance * resolution   // distance de clustering en mètres
  const result: any[] = []

  for (const features of groups.values()) {
    // 2. Clustering spatial greedy à l'intérieur du groupe
    const clusters: { cx: number; cy: number; members: any[] }[] = []

    for (const f of features) {
      const [fx, fy] = f.getGeometry().getCoordinates()
      let merged = false
      for (const cl of clusters) {
        const dx = fx - cl.cx, dy = fy - cl.cy
        if (Math.sqrt(dx * dx + dy * dy) <= meterDist) {
          cl.members.push(f)
          // Recalculer le centroïde (moyenne glissante)
          const n = cl.members.length
          cl.cx += (fx - cl.cx) / n
          cl.cy += (fy - cl.cy) / n
          merged = true
          break
        }
      }
      if (!merged) clusters.push({ cx: fx, cy: fy, members: [f] })
    }

    // 3. Créer une feature d'affichage par cluster
    for (const cl of clusters) {
      const df = new OlFeature(new OlPoint([cl.cx, cl.cy]))
      df.set('_members', cl.members)
      df.set('_size',    cl.members.length)
      const mp = cl.members[0].getProperties()
      df.set('ordre',  mp.ordre  ?? 3)
      df.set('statut', mp.statut ?? 'inconnu')
      if (cl.members.length === 1) df.setId(cl.members[0].getId())
      result.push(df)
    }
  }

  return result
}

const BASEMAPS: { id: Basemap; label: string; color: string }[] = [
  { id: 'osm',          label: 'OpenStreetMap',   color: '#E8E0D0' },
  { id: 'google-maps',  label: 'Google Maps',     color: '#E8F0FE' },
  { id: 'google-hybrid',label: 'Google Hybride',  color: '#3A4A2E' },
  { id: 'satellite',    label: 'Satellite (Esri)', color: '#1A2418' },
]

function getBasemapUrl(id: Basemap): string | null {
  switch (id) {
    case 'osm':          return null   // uses OSM class directly
    case 'google-maps':  return 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}'
    case 'google-hybrid':return 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
    case 'satellite':    return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
  }
}

// SVG pour le marqueur de position utilisateur
function makeLocMarkerSvg(): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <circle cx="16" cy="16" r="15" fill="rgba(66,133,244,0.18)" stroke="rgba(66,133,244,0.45)" stroke-width="1.5"/>
    <circle cx="16" cy="16" r="7"  fill="#4285F4" stroke="#fff" stroke-width="2.5"/>
  </svg>`
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}

// ── Marker helper ────────────────────────────────────────────────
//
// Règles de design :
//  • La FORME encode l'ordre  : triangle=1er, losange=2ème, cercle=3ème
//  • La COULEUR encode le statut (passée par l'appelant)
//  • Contour blanc 2px → lisible sur tous les fonds (OSM, satellite, hybride)
//  • La sélection est rendue par une couche OL dédiée (anneau géographique)
//    → le marqueur lui-même grossit légèrement mais reste sobre
//  • Ancre centre géométrique (anchor: [0.5, 0.5])

function makeSvgMarker(ordre: number, color: string, selected: boolean): string {
  const S   = selected ? 26 : 20
  const cx  = S / 2
  const cy  = S / 2
  const pad = 2
  const r   = S / 2 - pad

  // Contour blanc fin — lisible sans être envahissant
  const strokeW = 1.4
  const stroke  = 'rgba(255,255,255,0.88)'

  let shape: string

  if (ordre === 1) {
    // Triangle équilatéral de demi-base r → hauteur = r√3
    // (l'erreur précédente utilisait r√3/2, soit la hauteur d'un triangle de CÔTÉ r)
    const h    = r * Math.sqrt(3)
    const base = r
    const top  = cy - h * 2 / 3   // sommet   : 2/3 de h au-dessus du centroïde
    const bot  = cy + h / 3        // base     : 1/3 de h en-dessous du centroïde
    const arm  = r * 0.22          // croix intérieure légèrement agrandie
    shape = `
      <polygon points="${cx},${top} ${cx+base},${bot} ${cx-base},${bot}"
        fill="${color}" stroke="${stroke}" stroke-width="${strokeW}" stroke-linejoin="round"/>
      <line x1="${cx}" y1="${cy-arm}" x2="${cx}" y2="${cy+arm}"
        stroke="${stroke}" stroke-width="1.0" stroke-linecap="round" opacity="0.8"/>
      <line x1="${cx-arm}" y1="${cy}" x2="${cx+arm}" y2="${cy}"
        stroke="${stroke}" stroke-width="1.0" stroke-linecap="round" opacity="0.8"/>`

  } else if (ordre === 2) {
    shape = `
      <polygon points="${cx},${pad} ${S-pad},${cy} ${cx},${S-pad} ${pad},${cy}"
        fill="${color}" stroke="${stroke}" stroke-width="${strokeW}" stroke-linejoin="round"/>
      <circle cx="${cx}" cy="${cy}" r="${r * 0.15}" fill="${stroke}" opacity="0.85"/>`

  } else {
    shape = `
      <circle cx="${cx}" cy="${cy}" r="${r}"
        fill="${color}" stroke="${stroke}" stroke-width="${strokeW}"/>
      <circle cx="${cx}" cy="${cy}" r="${r * 0.20}" fill="${stroke}" opacity="0.85"/>`
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">${shape}</svg>`
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}

// ── Cluster helper ─────────────────────────────────────────────────
// Même forme que le marqueur individuel (ordre → triangle/losange/cercle),
// même couleur (statut), avec le nombre d'éléments agrégés inscrit à l'intérieur.
function makeClusterMarkerSvg(ordre: number, color: string, count: number): string {
  // Taille plus grande que le marqueur simple pour absorber le texte
  const S   = count < 10 ? 32 : count < 100 ? 38 : 44
  const cx  = S / 2, cy = S / 2
  const pad = 2.5
  const r   = S / 2 - pad

  const strokeW = 2.0
  const stroke  = 'rgba(255,255,255,0.90)'
  // Taille de police adaptée au nb de chiffres
  const fs = count < 10 ? 12 : count < 100 ? 10 : 8

  let shape: string
  let textY = cy    // position verticale du texte (centroïde)

  if (ordre === 1) {
    // Triangle équilatéral de demi-base r → hauteur = r√3
    const h    = r * Math.sqrt(3)
    const base = r
    const top  = cy - (h * 2) / 3
    const bot  = cy + h / 3
    textY = cy   // centroïde géométrique = cy (invariant avec la formule corrigée)
    shape = `<polygon points="${cx},${top} ${cx + base},${bot} ${cx - base},${bot}"
        fill="${color}" stroke="${stroke}" stroke-width="${strokeW}" stroke-linejoin="round"/>`
  } else if (ordre === 2) {
    // Losange — centroïde = centre géométrique
    shape = `<polygon points="${cx},${pad} ${S - pad},${cy} ${cx},${S - pad} ${pad},${cy}"
        fill="${color}" stroke="${stroke}" stroke-width="${strokeW}" stroke-linejoin="round"/>`
  } else {
    // Cercle
    shape = `<circle cx="${cx}" cy="${cy}" r="${r}"
        fill="${color}" stroke="${stroke}" stroke-width="${strokeW}"/>`
  }

  const text = `<text x="${cx}" y="${textY}" text-anchor="middle" dominant-baseline="central"
      font-family="monospace" font-size="${fs}" font-weight="700" fill="white"
      paint-order="stroke" stroke="rgba(0,0,0,0.25)" stroke-width="2">${count}</text>`

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">${shape}${text}</svg>`
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}

// ── Rayon de l'anneau de sélection (en mètres, EPSG:3857) ────────
// 45 m → ~36 px à zoom 17 (bâtiments visibles) — distingue le point de ses voisins
const SELECTION_RING_RADIUS_M = 45

// ── Scale bar helper ─────────────────────────────────────────────

function niceDistance(meters: number): string {
  if (meters >= 1000) {
    const km = meters / 1000
    return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`
  }
  return `${Math.round(meters)} m`
}

// ── Composant ────────────────────────────────────────────────────

export function MapCanvas({ points, selectedId, onPickPoint }: MapCanvasProps) {
  const { lang } = useLanguage()

  // Map refs
  const mapRef             = useRef<HTMLDivElement>(null)
  const mapInstanceRef     = useRef<any>(null)
  const vectorSourceRef    = useRef<any>(null)
  const vectorLayerRef     = useRef<any>(null)
  const tileLayerRef       = useRef<any>(null)
  const olRef              = useRef<any>(null)   // modules OL mis en cache après init
  const measureSourceRef   = useRef<any>(null)
  const drawInteractionRef = useRef<any>(null)
  const locMarkerSourceRef = useRef<any>(null)   // marqueur GPS utilisateur
  const selectionSourceRef = useRef<any>(null)   // anneau de sélection (cercle géographique)
  const displaySourceRef   = useRef<any>(null)   // features d'affichage (clusters + points seuls)
  const selectedIdRef      = useRef<number | null>(null)   // id sélectionné (lu par le style OL)
  const currentZoomRef     = useRef<number>(DEFAULT_ZOOM)  // zoom courant (lu par le style OL pour les étiquettes)
  const latestPointsRef    = useRef<GeoJSONFeatureCollection | null>(null) // dernières données reçues (résout la race condition init async / cache)

  // UI state
  const [activeTool,        setActiveTool]        = useState<Tool>('pan')
  const [basemap,           setBasemap]            = useState<Basemap>('osm')
  const [showBasemapPicker, setShowBasemapPicker]  = useState(false)
  const [cursorCoords,      setCursorCoords]       = useState<[number, number] | null>(null)
  const [currentZoom,       setCurrentZoom]        = useState(DEFAULT_ZOOM)
  const [scaleLabel,        setScaleLabel]         = useState('')
  const [measureText,       setMeasureText]        = useState<string | null>(null)
  const [locating,          setLocating]           = useState(false)
  const [isOffline,         setIsOffline]          = useState(false)
  const [tilesLoading,      setTilesLoading]       = useState(false)

  // ── 1. Initialisation de la carte ──────────────────────────────

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return
    let isMounted = true

    async function initMap() {
      const [
        { default: OlMap    },
        { default: View     },
        { default: TileLayer },
        { default: OSM      },
        { default: XYZ      },
        { default: VectorLayer  },
        { default: VectorSource },
        { default: GeoJSON  },
        { Style, Icon: OlIcon, Stroke, Fill, Circle: CircleStyle, Text: OlText },
        { fromLonLat, toLonLat },
        { default: Draw      },
        sphereModule,
        { default: OlFeature },
        { default: OlPoint   },
        { default: OlCircleGeom },
      ] = await Promise.all([
        import('ol/Map'),
        import('ol/View'),
        import('ol/layer/Tile'),
        import('ol/source/OSM'),
        import('ol/source/XYZ'),
        import('ol/layer/Vector'),
        import('ol/source/Vector'),
        import('ol/format/GeoJSON'),
        import('ol/style'),
        import('ol/proj'),
        import('ol/interaction/Draw'),
        import('ol/sphere'),
        import('ol/Feature'),
        import('ol/geom/Point'),
        import('ol/geom/Circle'),  // anneau de sélection géographique
      ])

      if (!isMounted || !mapRef.current) return

      // Cache les modules pour utilisation ultérieure
      olRef.current = {
        OlMap, View, TileLayer, OSM, XYZ,
        VectorLayer, VectorSource, GeoJSON,
        Style, OlIcon, Stroke, Fill, CircleStyle, OlText,
        fromLonLat, toLonLat,
        Draw, OlFeature, OlPoint, OlCircleGeom,
        getLength: sphereModule.getLength,
      }

      // ── Source vecteur brute — points géodésiques ────────────────
      const vectorSource = new VectorSource({ format: new GeoJSON() })
      vectorSourceRef.current = vectorSource

      // ── Source d'affichage — alimentée par buildDisplayFeatures ──
      // Contient clusters (N membres) + points seuls, regroupés par (ordre, statut)
      const displaySource = new VectorSource()
      displaySourceRef.current = displaySource

      // Source vecteur — mesures
      const measureSource = new VectorSource()
      measureSourceRef.current = measureSource

      // ── Helper : reconstruit displaySource à partir de vectorSource ──
      const refreshClusters = () => {
        if (!vectorSourceRef.current || !displaySourceRef.current || !mapInstanceRef.current) return
        const resolution = mapInstanceRef.current.getView().getResolution() ?? 1
        const raw        = vectorSourceRef.current.getFeatures()
        const { OlFeature: OlFeat, OlPoint: OlPt } = olRef.current
        const display    = buildDisplayFeatures(raw, resolution, 40, OlFeat, OlPt)
        displaySourceRef.current.clear()
        displaySourceRef.current.addFeatures(display)
      }

      // ── Style des marqueurs / clusters ──────────────────────────
      const vectorLayer = new VectorLayer({
        source: displaySource,
        zIndex: 10,
        style: (feature: any) => {
          const members = feature.get('_members') as any[] | undefined
          const size    = feature.get('_size')    as number ?? 1

          const ordre  = feature.get('ordre')  ?? members?.[0]?.getProperties()?.ordre  ?? 3
          const statut = feature.get('statut') ?? members?.[0]?.getProperties()?.statut ?? 'inconnu'
          const color  = STATUT_COLORS[statut] ?? '#9BA5AC'

          if (size > 1) {
            // ── Cluster : même forme + nb agrégés inscrit à l'intérieur ──────
            return new Style({
              image: new OlIcon({
                src:    makeClusterMarkerSvg(ordre, color, size),
                anchor: [0.5, 0.5],
              }),
            })
          }

          // ── Point unique ──────────────────────────────────────────────────
          const fid   = feature.getId()
          const isSel = fid === selectedIdRef.current
          const imgSrc = makeSvgMarker(ordre, color, isSel)

          // Étiquettes à partir du zoom 14 (navigation terrain)
          //  · zoom 14-15 → matricule (code court, unique)
          //  · zoom >= 16  → nom géographique (plus descriptif)
          const zoom = currentZoomRef.current
          if (zoom >= 14) {
            const rawProps = members?.[0]?.getProperties() ?? {}
            const label    = zoom >= 16
              ? (rawProps.nom || rawProps.matricule || '')
              : (rawProps.matricule || '')

            return new Style({
              image: new OlIcon({ src: imgSrc, anchor: [0.5, 0.5] }),
              text: label
                ? new OlText({
                    text:       label,
                    font:       'bold 10px "Inter", system-ui, sans-serif',
                    fill:       new Fill({ color: '#111827' }),
                    stroke:     new Stroke({ color: 'rgba(255,255,255,0.92)', width: 3 }),
                    offsetY:    isSel ? -17 : -14,   // au-dessus du marqueur
                    overflow:   true,
                    placement:  'point',
                  })
                : undefined,
            })
          }

          return new Style({
            image: new OlIcon({ src: imgSrc, anchor: [0.5, 0.5] }),
          })
        },
      })
      vectorLayerRef.current = vectorLayer

      // Layer mesures
      const measureLayer = new VectorLayer({
        source: measureSource,
        zIndex: 20,
        style: new Style({
          stroke: new Stroke({ color: '#B85729', width: 2, lineDash: [8, 4] }),
          image: new CircleStyle({
            radius: 5,
            fill: new Fill({ color: '#B85729' }),
            stroke: new Stroke({ color: '#fff', width: 2 }),
          }),
        }),
      })

      // Layer marqueur position utilisateur (GPS)
      const locMarkerSource = new VectorSource()
      locMarkerSourceRef.current = locMarkerSource
      const locMarkerLayer = new VectorLayer({
        source: locMarkerSource,
        zIndex: 40,
        style: new Style({
          image: new OlIcon({
            src: makeLocMarkerSvg(),
            anchor: [0.5, 0.5],
          }),
        }),
      })

      // ── Couche anneau de sélection (cercle géographique à tirets) ────
      // zIndex 5 : sous les marqueurs pour ne pas masquer les voisins
      const selectionSource = new VectorSource()
      selectionSourceRef.current = selectionSource
      const selectionLayer = new VectorLayer({
        source: selectionSource,
        zIndex: 5,
      })

      // Fond de carte OSM par défaut
      // preload: 2  → pré-charge les tuiles des 2 niveaux de zoom adjacents (moins de blanc au zoom)
      // transition: 0 → tuiles apparaissent immédiatement sans fondu (meilleur sur connexion lente)
      const tileLayer = new TileLayer({
        source: new OSM(),
        zIndex: 0,
        preload: 2,
        useInterimTilesOnError: true,   // affiche les vieilles tuiles pendant le rechargement
      })
      tileLayerRef.current = tileLayer

      // Zoom initial : préférence utilisateur > constante par défaut
      const savedZoom = Number(localStorage.getItem('rgnc-pref-zoom') || DEFAULT_ZOOM)
      const initZoom  = (savedZoom >= MIN_ZOOM && savedZoom <= MAX_ZOOM) ? savedZoom : DEFAULT_ZOOM

      // pixelRatio : limité à 2 max (évite un canvas 9× trop grand sur écrans 3× qui ralentit le rendu)
      const dpr = Math.min(window.devicePixelRatio || 1, 2)

      const map = new OlMap({
        target: mapRef.current!,
        layers: [tileLayer, selectionLayer, measureLayer, vectorLayer, locMarkerLayer],
        view: new View({
          center: fromLonLat(CAMEROON_CENTER),
          zoom: initZoom,
          minZoom: MIN_ZOOM,
          maxZoom: MAX_ZOOM,
        }),
        controls: [],
        pixelRatio: dpr,
      })
      mapInstanceRef.current = map

      // ── Indicateur de chargement des tuiles ──────────────────────
      tileLayer.getSource()?.on('tileloadstart', () => setTilesLoading(true))
      tileLayer.getSource()?.on('tileloadend',   () => setTilesLoading(false))
      tileLayer.getSource()?.on('tileloaderror', () => setTilesLoading(false))

      // ── Race condition : si les données étaient déjà disponibles pendant l'init async ──
      // (TanStack Query retourne le cache instantanément au 2e passage sur la page,
      //  avant que les imports dynamiques OL soient résolus → useEffect[points] s'est
      //  exécuté mais a vu vectorSourceRef.current = null → rien n'a été ajouté)
      if (latestPointsRef.current) {
        const fmt      = new GeoJSON()
        const features = fmt.readFeatures(latestPointsRef.current, {
          featureProjection: 'EPSG:3857',
          dataProjection:    'EPSG:4326',
        })
        vectorSource.addFeatures(features)
        const resolution = map.getView().getResolution() ?? 1
        const display    = buildDisplayFeatures(features, resolution, 40, OlFeature, OlPoint)
        displaySource.addFeatures(display)

        // Zoom sur l'étendue des données disponibles au démarrage
        if (features.length > 0) {
          const extent = vectorSource.getExtent()
          if (isFinite(extent[0])) {
            map.getView().fit(extent, {
              padding:  [60, 60, 60, 60],
              maxZoom:  16,
              duration: 600,
            })
          }
        }
      }

      // Clic → sélection ou zoom cluster
      map.on('click', (evt: any) => {
        const displayFeature = map.forEachFeatureAtPixel(evt.pixel, (f: any) => f, {
          layerFilter: (l: any) => l === vectorLayer,
        })
        if (!displayFeature) return

        const size    = displayFeature.get('_size') as number ?? 1
        const members = displayFeature.get('_members') as any[] | undefined

        if (size > 1) {
          // Cluster → zoom pour décluster
          const view    = map.getView()
          const center  = displayFeature.getGeometry()?.getCoordinates?.()
          const curZoom = view.getZoom() ?? DEFAULT_ZOOM
          view.animate({ center, zoom: curZoom + 3, duration: 500 })
        } else {
          // Point unique → sélection
          // L'id est copié sur la display feature dans buildDisplayFeatures
          const id = displayFeature.getId() as number ?? members?.[0]?.getId()
          if (id != null) onPickPoint(id)
        }
      })

      // Pointermove → curseur pointer sur marqueur ou cluster + coordonnées
      // ─ On cible map.getViewport() (le div interactif OL, pas son conteneur parent)
      // ─ hitTolerance: 8 px pour absorber les petits marqueurs SVG
      map.on('pointermove', (evt: any) => {
        if (evt.dragging) return
        const hit = map.hasFeatureAtPixel(evt.pixel, {
          layerFilter:  (l: any) => l === vectorLayer,
          hitTolerance: 8,
        })
        ;(map.getViewport() as HTMLElement).style.cursor = hit ? 'pointer' : ''
        const [lon, lat] = toLonLat(evt.coordinate)
        setCursorCoords([lon, lat])
      })

      // Moveend → zoom + barre d'échelle + recalcul clusters + refresh étiquettes
      const updateZoomScale = () => {
        const view       = map.getView()
        const z          = view.getZoom() ?? DEFAULT_ZOOM
        const resolution = view.getResolution() ?? 1
        setCurrentZoom(z)
        currentZoomRef.current = z   // lu par le style OL pour afficher/masquer les étiquettes
        setScaleLabel(niceDistance(72 * resolution))
        // Recalculer les clusters selon la résolution courante
        refreshClusters()
      }
      map.on('moveend', updateZoomScale)
      updateZoomScale()

      // Détection hors-ligne
      setIsOffline(!navigator.onLine)
      window.addEventListener('online',  () => setIsOffline(false))
      window.addEventListener('offline', () => setIsOffline(true))

    }

    initMap()
    return () => {
      isMounted = false
      if (mapInstanceRef.current) {
        mapInstanceRef.current.setTarget(undefined)
        mapInstanceRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── 1b. Écoute des changements de préférences utilisateur ────
  // Déclenché par PrefModal via window.dispatchEvent('rgnc-pref-changed')
  useEffect(() => {
    const handler = (e: Event) => {
      const { zoom } = (e as CustomEvent<{ zoom: number }>).detail ?? {}
      if (zoom && mapInstanceRef.current) {
        mapInstanceRef.current.getView().animate({ zoom, duration: 500 })
      }
    }
    window.addEventListener('rgnc-pref-changed', handler)
    return () => window.removeEventListener('rgnc-pref-changed', handler)
  }, [])

  // ── 2. Mise à jour des entités (points) ───────────────────────

  useEffect(() => {
    // Toujours mémoriser les dernières données — résout la race condition :
    // TanStack Query peut retourner le cache *avant* que initMap() termine
    latestPointsRef.current = points
    if (!vectorSourceRef.current || !points) return
    async function updateFeatures() {
      const { default: GeoJSON } = await import('ol/format/GeoJSON')
      const source = vectorSourceRef.current
      source.clear()
      const fmt      = new GeoJSON()
      const features = fmt.readFeatures(points, {
        featureProjection: 'EPSG:3857',
        dataProjection:    'EPSG:4326',
      })
      source.addFeatures(features)

      // Reconstruire la source d'affichage (clusters + points seuls)
      if (displaySourceRef.current && mapInstanceRef.current) {
        const resolution = mapInstanceRef.current.getView().getResolution() ?? 1
        const { OlFeature: OlFeat, OlPoint: OlPt } = olRef.current ?? {}
        if (OlFeat && OlPt) {
          const display = buildDisplayFeatures(features, resolution, 40, OlFeat, OlPt)
          displaySourceRef.current.clear()
          displaySourceRef.current.addFeatures(display)
        }
      }

      // ── Zoom automatique sur l'étendue des données ──────────────
      // Déclenché à chaque changement de filtre → la carte se recentre sur les points visibles
      if (features.length > 0 && mapInstanceRef.current) {
        const extent = source.getExtent()
        // getExtent() renvoie [Inf, Inf, -Inf, -Inf] si la source est vide
        if (isFinite(extent[0])) {
          mapInstanceRef.current.getView().fit(extent, {
            padding:  [60, 60, 60, 60],   // marge en px (top/right/bottom/left)
            maxZoom:  16,                  // évite de trop zoomer sur 1 seul point
            duration: 600,
          })
        }
      }
    }
    updateFeatures()
  }, [points])

  // ── 3. Fly-to + anneau de sélection ─────────────────────────────

  useEffect(() => {
    // Synchroniser la ref (lue par le style OL — closure ne capture pas les re-renders React)
    selectedIdRef.current = selectedId ?? null

    // Nettoyer l'anneau quand rien n'est sélectionné
    if (selectedId == null) {
      selectionSourceRef.current?.clear()
      vectorLayerRef.current?.changed()
      return
    }
    if (!mapInstanceRef.current || !vectorSourceRef.current || !olRef.current) return

    const feature = vectorSourceRef.current.getFeatureById(selectedId)
    if (!feature) return

    const coords = feature.getGeometry()?.getCoordinates?.()
    if (!coords) return

    // ── Fly-to zoom bâtiment (niveau 17 = bâtiments bien visibles) ──
    const view = mapInstanceRef.current.getView()
    const currentZoom = view.getZoom() ?? DEFAULT_ZOOM
    view.animate({
      center:   coords,
      zoom:     Math.max(currentZoom, 17),   // au moins zoom 17 pour voir les bâtiments
      duration: 700,
    })

    // ── Anneau de sélection géographique à tirets ──────────────────
    const { OlFeature, OlCircleGeom, Style, Stroke } = olRef.current
    const statut = feature.getProperties()?.statut ?? 'inconnu'
    const ringColor = STATUT_COLORS[statut] ?? '#9BA5AC'

    selectionSourceRef.current?.clear()

    // OlCircleGeom(centre_EPSG3857, rayon_en_mètres)
    const circle = new OlCircleGeom(coords, SELECTION_RING_RADIUS_M)
    const ringFeature = new OlFeature(circle)
    ringFeature.setStyle(new Style({
      stroke: new Stroke({
        color:    ringColor,
        width:    2.5,
        lineDash: [9, 6],   // tirets espacés — clairement distinct des contours de marqueurs
      }),
    }))
    selectionSourceRef.current?.addFeature(ringFeature)

    // Forcer le re-rendu du layer marqueurs (marqueur sélectionné grossit)
    vectorLayerRef.current?.changed()
  }, [selectedId])

  // ── 4. Changement de fond de carte ────────────────────────────

  useEffect(() => {
    if (!tileLayerRef.current || !olRef.current) return
    const { XYZ, OSM } = olRef.current
    const url = getBasemapUrl(basemap)
    if (url) {
      tileLayerRef.current.setSource(new XYZ({ url }))
    } else {
      tileLayerRef.current.setSource(new OSM())
    }
    tileLayerRef.current.set('preload', 2)
  }, [basemap])

  // ── 5. Outil mesure — ajout/retrait de l'interaction Draw ─────

  useEffect(() => {
    if (!mapInstanceRef.current || !olRef.current || !measureSourceRef.current) return
    const { Draw, Style, Stroke, Fill, CircleStyle } = olRef.current

    // Supprimer l'interaction précédente
    if (drawInteractionRef.current) {
      mapInstanceRef.current.removeInteraction(drawInteractionRef.current)
      drawInteractionRef.current = null
    }

    if (activeTool !== 'measure') {
      measureSourceRef.current.clear()
      setMeasureText(null)
      return
    }

    // Vider les mesures précédentes
    measureSourceRef.current.clear()
    setMeasureText(null)

    const draw = new Draw({
      source: measureSourceRef.current,
      type:   'LineString',
      style: new Style({
        stroke: new Stroke({ color: '#B85729', width: 2, lineDash: [8, 4] }),
        image: new CircleStyle({
          radius: 5,
          fill: new Fill({ color: '#B85729' }),
          stroke: new Stroke({ color: '#fff', width: 2 }),
        }),
      }),
    })

    draw.on('drawend', (evt: any) => {
      const { getLength } = olRef.current
      const geom     = evt.feature.getGeometry()
      const meters   = getLength(geom)   // longueur géodésique en mètres
      setMeasureText(niceDistance(meters))
    })

    mapInstanceRef.current.addInteraction(draw)
    drawInteractionRef.current = draw

    return () => {
      if (mapInstanceRef.current && drawInteractionRef.current) {
        mapInstanceRef.current.removeInteraction(drawInteractionRef.current)
        drawInteractionRef.current = null
      }
    }
  }, [activeTool])

  // ── 6. Géolocalisation ────────────────────────────────────────

  const handleLocate = useCallback(() => {
    if (!navigator.geolocation || !mapInstanceRef.current || !olRef.current) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { fromLonLat, OlFeature, OlPoint, Style, OlIcon } = olRef.current
        const center = fromLonLat([pos.coords.longitude, pos.coords.latitude])

        // Centrer + zoomer
        mapInstanceRef.current.getView().animate({ center, zoom: 16, duration: 800 })

        // Placer / déplacer le marqueur de position
        if (locMarkerSourceRef.current) {
          locMarkerSourceRef.current.clear()
          const locFeature = new OlFeature({ geometry: new OlPoint(center) })
          locFeature.setStyle(new Style({
            image: new OlIcon({ src: makeLocMarkerSvg(), anchor: [0.5, 0.5] }),
          }))
          locMarkerSourceRef.current.addFeature(locFeature)
        }

        setLocating(false)
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [])

  // ── Zoom helpers ──────────────────────────────────────────────

  const zoomIn = useCallback(() => {
    const view = mapInstanceRef.current?.getView()
    if (view) view.animate({ zoom: (view.getZoom() ?? DEFAULT_ZOOM) + 1, duration: 200 })
  }, [])

  const zoomOut = useCallback(() => {
    const view = mapInstanceRef.current?.getView()
    if (view) view.animate({ zoom: (view.getZoom() ?? DEFAULT_ZOOM) - 1, duration: 200 })
  }, [])

  const centerOnCameroon = useCallback(() => {
    if (!mapInstanceRef.current || !olRef.current) return
    const { fromLonLat } = olRef.current
    mapInstanceRef.current.getView().animate({
      center: fromLonLat(CAMEROON_CENTER),
      zoom: DEFAULT_ZOOM,
      duration: 600,
    })
  }, [])

  // ── Rendu ─────────────────────────────────────────────────────

  return (
    <div className="map-area">
      {/* Fond de carte OL */}
      <div ref={mapRef} style={{ position: 'absolute', inset: 0 }} />

      {/* Bandeau hors-ligne */}
      {isOffline && (
        <div className="offline-strip">
          <Icon name="wifi-off" size={14} />
          Mode hors-ligne — tuiles en cache uniquement
        </div>
      )}

      {/* Indicateur de chargement des tuiles */}
      {tilesLoading && !isOffline && (
        <div style={{
          position: 'absolute', bottom: 44, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.55)', color: '#fff',
          fontSize: 11, padding: '4px 10px', borderRadius: 12,
          display: 'flex', alignItems: 'center', gap: 6, zIndex: 10, pointerEvents: 'none',
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80',
            animation: 'pulse 1s infinite' }} />
          Chargement de la carte…
        </div>
      )}

      {/* ── Barre d'outils (haut-droite) ── */}
      <div className="map-toolbar">
        {/* Pan */}
        <button
          className={`map-tool-btn${activeTool === 'pan' ? ' active' : ''}`}
          title={lang === 'fr' ? 'Déplacer' : 'Pan'}
          onClick={() => setActiveTool('pan')}
        >
          <Icon name="navigate" size={17} />
        </button>

        {/* Mesure */}
        <button
          className={`map-tool-btn${activeTool === 'measure' ? ' active' : ''}`}
          title={lang === 'fr' ? 'Mesurer une distance' : 'Measure distance'}
          onClick={() => setActiveTool((t) => t === 'measure' ? 'pan' : 'measure')}
        >
          <Icon name="ruler" size={17} />
        </button>

        <div className="map-tool-sep" />

        {/* Sélecteur de fond de carte */}
        <div style={{ position: 'relative' }}>
          <button
            className={`map-tool-btn${showBasemapPicker ? ' active' : ''}`}
            title={lang === 'fr' ? 'Fond de carte' : 'Basemap'}
            onClick={() => setShowBasemapPicker((v) => !v)}
          >
            <Icon name="layers" size={17} />
          </button>

          {showBasemapPicker && (
            <div className="basemap-picker">
              <div className="basemap-picker-title">
                {lang === 'fr' ? 'Fond de carte' : 'Basemap'}
              </div>
              {BASEMAPS.map((b) => (
                <button
                  key={b.id}
                  className={`basemap-option${basemap === b.id ? ' active' : ''}`}
                  onClick={() => { setBasemap(b.id); setShowBasemapPicker(false) }}
                >
                  <span
                    className="basemap-thumb"
                    style={{
                      background: b.color,
                      border: basemap === b.id ? '2px solid var(--rgnc-foret-700)' : '1px solid var(--border-subtle)',
                    }}
                  />
                  {b.label}
                  {basemap === b.id && (
                    <Icon name="check" size={12} color="var(--rgnc-foret-700)" strokeWidth={2.5}
                      style={{ marginLeft: 'auto' }} />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Géolocalisation */}
        <button
          className={`map-tool-btn${locating ? ' active' : ''}`}
          title={lang === 'fr' ? 'Ma position' : 'My location'}
          onClick={handleLocate}
        >
          <Icon name={locating ? 'loader' : 'crosshair'} size={17}
            style={locating ? { animation: 'spin 1s linear infinite' } : undefined} />
        </button>

        {/* Centrer Cameroun */}
        <button
          className="map-tool-btn"
          title={lang === 'fr' ? 'Centrer sur le Cameroun' : 'Center on Cameroon'}
          onClick={centerOnCameroon}
        >
          <Icon name="map-pin" size={17} />
        </button>
      </div>

      {/* ── Zoom (bas-droite) ── */}
      <div className="map-zoom">
        <button className="map-zoom-btn" aria-label="Zoom avant" onClick={zoomIn}>
          <Icon name="plus" size={15} />
        </button>
        <div style={{ height: 1, background: 'var(--border-subtle)', margin: '1px 4px' }} />
        <button className="map-zoom-btn" aria-label="Zoom arrière" onClick={zoomOut}>
          <Icon name="minus" size={15} />
        </button>
      </div>

      {/* ── Barre d'échelle (bas-centre) ── */}
      <div className="scalebar">
        <div className="scalebar-bar" />
        <span>{scaleLabel}</span>
        <span className="scalebar-meta">Z{Math.round(currentZoom)}</span>
      </div>

      {/* ── Tracker de coordonnées (bas-droite, au-dessus du zoom) ── */}
      {cursorCoords && (
        <div className="coord-tracker">
          {Math.abs(cursorCoords[1]).toFixed(5)}°{cursorCoords[1] >= 0 ? 'N' : 'S'}
          &nbsp;·&nbsp;
          {Math.abs(cursorCoords[0]).toFixed(5)}°{cursorCoords[0] >= 0 ? 'E' : 'W'}
        </div>
      )}

      {/* ── Résultat mesure ── */}
      {measureText && activeTool === 'measure' && (
        <div style={{
          position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--rgnc-encre-900)', color: '#fff',
          padding: '7px 14px', borderRadius: 'var(--radius-pill)',
          fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: 'var(--shadow-md)', zIndex: 'var(--z-map-ui)' as any,
          pointerEvents: 'none',
        }}>
          <Icon name="ruler" size={14} />
          {measureText}
          <span style={{ fontSize: 10, opacity: 0.6, fontWeight: 400 }}>
            — {lang === 'fr' ? 'double-clic pour terminer' : 'double-click to finish'}
          </span>
        </div>
      )}

      {/* Conseil outil mesure actif */}
      {activeTool === 'measure' && !measureText && (
        <div style={{
          position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(184, 87, 41, 0.9)', color: '#fff',
          padding: '6px 14px', borderRadius: 'var(--radius-pill)',
          fontSize: 12, display: 'flex', alignItems: 'center', gap: 7,
          boxShadow: 'var(--shadow-md)', zIndex: 'var(--z-map-ui)' as any,
          pointerEvents: 'none',
        }}>
          <Icon name="ruler" size={13} />
          {lang === 'fr'
            ? 'Cliquez pour mesurer · double-clic pour terminer'
            : 'Click to measure · double-click to finish'}
        </div>
      )}

      {/* ── Légende (bas-gauche) ── */}
      <div className="map-legend">
        <div className="legend-title">
          {lang === 'fr' ? 'Légende' : 'Legend'}
        </div>

        {/* ─ Ordre réseau — forme = ordre, couleur = statut ─ */}
        <div className="legend-section-label">
          {lang === 'fr' ? 'Ordre réseau' : 'Network order'}
        </div>
        {([
          { o: 1, label: lang === 'fr' ? '1er ordre'   : '1st order',   sub: lang === 'fr' ? 'Canevas fondamental'  : 'Fundamental framework' },
          { o: 2, label: lang === 'fr' ? '2ème ordre'  : '2nd order',   sub: lang === 'fr' ? "Réseau d'appui"       : 'Support network'        },
          { o: 3, label: lang === 'fr' ? '3ème ordre'  : '3rd order',   sub: lang === 'fr' ? 'Densification locale' : 'Local densification'    },
        ] as const).map(({ o, label, sub }) => (
          <div key={o} className="legend-item" style={{ alignItems: 'flex-start', gap: 9 }}>
            <OrdreIcon ordre={o} size={14} color="var(--fg-2)" style={{ marginTop: 2, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg-1)', lineHeight: 1.3 }}>{label}</div>
              <div style={{ fontSize: 10, color: 'var(--fg-4)', lineHeight: 1.3 }}>{sub}</div>
            </div>
          </div>
        ))}

        {/* ─ Statut — couleur du marqueur ─ */}
        <div className="legend-section-label" style={{ marginTop: 8 }}>
          {lang === 'fr' ? 'Couleur = statut' : 'Color = status'}
        </div>
        {[
          { color: '#1F5D3A', label: lang === 'fr' ? 'Conforme (actif)'   : 'Compliant (active)'  },
          { color: '#D4A017', label: lang === 'fr' ? 'Dégradé (à vérifier)': 'Degraded (to verify)'},
          { color: '#B83434', label: lang === 'fr' ? 'Détruit'             : 'Destroyed'           },
          { color: '#9BA5AC', label: lang === 'fr' ? 'Inconnu'             : 'Unknown'             },
          { color: '#B85729', label: lang === 'fr' ? 'Sélectionné'         : 'Selected'            },
        ].map(({ color, label }) => (
          <div key={color} className="legend-item">
            <span className="legend-dot" style={{ background: color }} />
            <span style={{ fontSize: 11 }}>{label}</span>
          </div>
        ))}

        {/* ─ Position utilisateur ─ */}
        <div className="legend-section-label" style={{ marginTop: 8 }}>
          {lang === 'fr' ? 'Ma position' : 'My location'}
        </div>
        <div className="legend-item">
          <span style={{
            width: 13, height: 13, borderRadius: '50%', flexShrink: 0,
            background: 'rgba(66,133,244,0.25)', border: '2px solid #4285F4',
            display: 'inline-block',
          }} />
          <span style={{ fontSize: 11 }}>{lang === 'fr' ? 'Localisation GPS' : 'GPS location'}</span>
        </div>
      </div>
    </div>
  )
}
