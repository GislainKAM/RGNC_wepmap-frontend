'use client'

import React, { useRef, useEffect, useCallback, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { OrdreIcon } from '@/components/ui/OrdreIcon'
import { useLanguage } from '@/hooks/useLanguage'
import { useAuth } from '@/hooks/useAuth'
import type { GeoJSONFeatureCollection, ZoneInteret } from '@/lib/types'
import { CAMEROON_CENTER, DEFAULT_ZOOM, MIN_ZOOM, MAX_ZOOM } from '@/lib/constants'

// ── Types ────────────────────────────────────────────────────────

interface MapCanvasProps {
  points:      GeoJSONFeatureCollection | null
  selectedId:  number | null
  onPickPoint: (id: number) => void
  /** Emprise à mettre en évidence ; le reste de la carte est assombri. */
  zone?:       ZoneInteret | null
  /** Ouvre ou referme le panneau de filtres — bouton mobile de la carte. */
  onBasculerFiltres?: () => void
  /** État du panneau : commande l'icône, qui doit annoncer le sens du geste. */
  filtresOuverts?: boolean
  /** Nombre de critères actifs, affiché en pastille sur ce bouton. */
  nbFiltresActifs?: number
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

// ── Cache SVG markers ────────────────────────────────────────────
// La fonction style OL est rappelée à CHAQUE frame pour CHAQUE feature.
// Sans cache, on génère + encode un nouveau SVG 50-100× par frame sur mobile
// → le thread JS est bloqué → les tuiles restent grises en attendant.
// Avec cache : ~24 entrées → quasiment 0 coût. Les clusters réutilisent ces
// mêmes entrées, leur symbole étant celui d'une entité isolée.
const _svgMarkerCache    = new Map<string, string>()

// Réglages de chargement des tuiles, communs à tous les fonds de carte.
// preload → pré-charge les niveaux de zoom adjacents (moins de blanc au zoom) ;
// useInterimTilesOnError → garde les vieilles tuiles pendant un rechargement,
// au lieu de laisser un trou gris. Les deux comptent surtout sur mobile.
const TUILES_CHARGEMENT = { preload: 4, useInterimTilesOnError: true }

// Style du tracé de mesure, passé au MeasureTool du SDK.
const MESURE_COULEUR = '#B85729'

// Anneau d'amas : le marqueur non sélectionné fait 20 px centré sur son ancre
// (10 px de rayon). 13 px place l'anneau juste au-delà, assez près pour se
// lire comme un attribut du symbole plutôt que comme un objet distinct.
const CLUSTER_RING_RADIUS = 13

// ── Clé de regroupement pour clusterByGroup (@websig-app/geo-core) ──
// Deux features ne fusionnent jamais si elles n'ont pas le même (ordre,
// statut) — voir docs/architecture.md de geosig-sdk, "Clustering qui ne
// mélange jamais deux catégories".
function clusterGroupKey(feature: any): string {
  const p = feature.getProperties()
  return `${p.ordre ?? 3}__${p.statut ?? 'inconnu'}`
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
  const cacheKey = `${ordre}|${color}|${selected}`
  if (_svgMarkerCache.has(cacheKey)) return _svgMarkerCache.get(cacheKey)!

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
  const result = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
  _svgMarkerCache.set(cacheKey, result)
  return result
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

export function MapCanvas({
  points, selectedId, onPickPoint, zone,
  onBasculerFiltres, filtresOuverts = false, nbFiltresActifs = 0,
}: MapCanvasProps) {
  const { t } = useLanguage()
  const role = useAuth((s) => s.user?.role)

  // Capacités de carte du rôle courant, au sens RoleProvider du SDK.
  //
  // Le SDK interroge cette fonction avant d'activer un outil, y compris sur un
  // appel direct à l'API — la restriction ne peut donc pas être contournée en
  // masquant seulement le bouton (§5.3 du cahier des charges).
  //
  // La correspondance rôle → capacité ci-dessous reproduit le comportement
  // actuel : la mesure reste ouverte à tous, y compris aux visiteurs non
  // connectés. C'est une décision produit, à resserrer ici si le besoin
  // apparaît, sans toucher au SDK.
  const roleProviderRef = useRef<{ hasCapability: (c: string) => boolean }>({
    hasCapability: () => true,
  })
  roleProviderRef.current = {
    hasCapability: (capability: string) =>
      capability === 'measure' ? true : role === 'geometre' || role === 'admin',
  }

  // Map refs
  const mapRef             = useRef<HTMLDivElement>(null)
  const controllerRef      = useRef<any>(null)   // MapController (@websig-app/geo-core)
  const mapInstanceRef     = useRef<any>(null)   // instance ol/Map brute — controllerRef.getMap()
  const vectorSourceRef    = useRef<any>(null)
  const vectorLayerRef     = useRef<any>(null)
  const tileLayerRef       = useRef<any>(null)
  const measureToolRef     = useRef<any>(null)   // MeasureTool (@websig-app/geo-core)
  const zoneLayerRef       = useRef<any>(null)   // couche masque, reconstruite par createMaskLayer
  const olRef              = useRef<any>(null)   // modules OL mis en cache après init
  const locMarkerSourceRef = useRef<any>(null)   // marqueur GPS utilisateur
  const selectionSourceRef = useRef<any>(null)   // anneau de sélection (cercle géographique)
  const zoneCadreeRef      = useRef<string | null>(null)  // dernière zone sur laquelle on a recadré
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
  // Motif d'échec de la géolocalisation. Distinguer le refus de permission de
  // l'échec technique n'est pas cosmétique : le premier se corrige dans les
  // réglages du navigateur, le second en sortant à découvert. Un message
  // unique laisserait le géomètre chercher au mauvais endroit.
  const [geoErreur,         setGeoErreur]          = useState<'refuse' | 'indisponible' | null>(null)
  const [isOffline,         setIsOffline]          = useState(false)
  const [tilesLoading,      setTilesLoading]       = useState(false)
  const [mapPrete,          setMapPrete]           = useState(false)

  // Indicateur « chargement de la carte » : à rebrancher sur chaque nouvelle
  // couche de fond, les écouteurs étant portés par la source.
  const brancherIndicateurTuiles = useCallback((couche: any) => {
    const source = couche.getSource()
    if (!source) return
    source.on('tileloadstart', () => setTilesLoading(true))
    source.on('tileloadend', () => setTilesLoading(false))
    source.on('tileloaderror', () => setTilesLoading(false))
  }, [])

  // ── 1. Initialisation de la carte ──────────────────────────────

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return
    let isMounted = true

    async function initMap() {
      const [
        { default: VectorLayer  },
        { default: VectorSource },
        { default: GeoJSON  },
        { Style, Icon: OlIcon, Stroke, Fill, Circle: CircleStyle, Text: OlText },
        { fromLonLat, toLonLat },
        sphereModule,
        { default: OlFeature },
        { default: OlPoint   },
        { default: OlCircleGeom },
        geoCore,
      ] = await Promise.all([
        import('ol/layer/Vector'),
        import('ol/source/Vector'),
        import('ol/format/GeoJSON'),
        import('ol/style'),
        import('ol/proj'),
        import('ol/sphere'),
        import('ol/Feature'),
        import('ol/geom/Point'),
        import('ol/geom/Circle'),  // anneau de sélection géographique
        import('@websig-app/geo-core'),
      ])
      const {
        MapController,
        createMaskLayer,
        createOsmBaseLayer,
        createXyzBaseLayer,
        geoJsonToFeatures,
        clusterByGroup,
        createCountRingStyle,
      } = geoCore

      if (!isMounted || !mapRef.current) return

      // Cache les modules pour utilisation ultérieure
      olRef.current = {
        VectorLayer, VectorSource, GeoJSON,
        Style, OlIcon, Stroke, Fill, CircleStyle, OlText,
        fromLonLat, toLonLat,
        OlFeature, OlPoint, OlCircleGeom,
        getLength: sphereModule.getLength,
        createMaskLayer, createOsmBaseLayer, createXyzBaseLayer,
        geoJsonToFeatures, clusterByGroup,
      }

      // ── Source vecteur brute — points géodésiques ────────────────
      const vectorSource = new VectorSource({ format: new GeoJSON() })
      vectorSourceRef.current = vectorSource

      // ── Source d'affichage — alimentée par clusterByGroup ──
      // Contient clusters (N membres) + points seuls, regroupés par (ordre, statut)
      const displaySource = new VectorSource()
      displaySourceRef.current = displaySource

      // ── Helper : reconstruit displaySource à partir de vectorSource ──
      const refreshClusters = () => {
        if (!vectorSourceRef.current || !displaySourceRef.current || !mapInstanceRef.current) return
        const resolution = mapInstanceRef.current.getView().getResolution() ?? 1
        const raw        = vectorSourceRef.current.getFeatures()
        const { clusterByGroup: cluster } = olRef.current
        const display = cluster(raw, resolution, { getGroupKey: clusterGroupKey, pixelDistance: 40 })
        displaySourceRef.current.clear()
        displaySourceRef.current.addFeatures(display)
      }

      // ── Style des marqueurs / clusters ──────────────────────────
      const vectorLayer = new VectorLayer({
        source: displaySource,
        zIndex: 10,
        // Ne pas re-rendre pendant les animations/interactions → tuiles restent nettes
        updateWhileAnimating:   false,
        updateWhileInteracting: false,
        style: (feature: any) => {
          const members = feature.get('_members') as any[] | undefined
          const size    = feature.get('_size')    as number ?? 1

          const ordre  = feature.get('ordre')  ?? members?.[0]?.getProperties()?.ordre  ?? 3
          const statut = feature.get('statut') ?? members?.[0]?.getProperties()?.statut ?? 'inconnu'
          const color  = STATUT_COLORS[statut] ?? '#9BA5AC'

          if (size > 1) {
            // ── Amas : le symbole de l'entité, inchangé, cerclé d'un anneau ──
            // dans sa propre couleur de statut, avec le compte en étiquette
            // contre l'anneau.
            //
            // L'anneau signale l'agrégation sans qu'on ait à lire le chiffre,
            // et n'ajoute aucune couleur au vocabulaire de la légende — une
            // pastille rouge, elle, annonçait « détruit » sur un amas de
            // bornes conformes. Le symbole garde forme (ordre) et couleur
            // (statut) : un amas se lit comme ce qu'il agrège.
            return [
              new Style({
                image: new OlIcon({ src: makeSvgMarker(ordre, color, false), anchor: [0.5, 0.5] }),
              }),
              createCountRingStyle(size, { color, radius: CLUSTER_RING_RADIUS }),
            ]
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

      // Fond de carte OSM par défaut, construit par le SDK.
      // preload / useInterimTilesOnError limitent les zones blanches et les
      // bandes grises pendant un zoom ou un réseau lent.
      const tileLayer = createOsmBaseLayer(TUILES_CHARGEMENT)
      tileLayer.setZIndex(0)
      tileLayerRef.current = tileLayer

      // Zoom initial : préférence utilisateur > constante par défaut
      const savedZoom = Number(localStorage.getItem('rgnc-pref-zoom') || DEFAULT_ZOOM)
      const initZoom  = (savedZoom >= MIN_ZOOM && savedZoom <= MAX_ZOOM) ? savedZoom : DEFAULT_ZOOM

      // pixelRatio : limité à 2 max (évite un canvas 9× trop grand sur écrans 3× qui ralentit le rendu)
      const dpr = Math.min(window.devicePixelRatio || 1, 2)

      // MapController pose le fond de carte + la vue ; la couche de masque est
      // construite à la volée par createMaskLayer au changement de zone. Les
      // couches restantes (sélection, marqueurs, GPS) n'ont pas d'équivalent
      // LayerSource — ajoutées directement sur la carte brute.
      //
      // Le roleProvider est celui du SDK : les outils construits via
      // controller.createMeasureTool() en héritent automatiquement, y compris
      // par appel direct à l'API (§5.3 du cahier des charges).
      const controller = new MapController({ roleProvider: roleProviderRef.current })
      const map = controller.init({
        target: mapRef.current!,
        center: fromLonLat(CAMEROON_CENTER),
        zoom: initZoom,
        minZoom: MIN_ZOOM,
        maxZoom: MAX_ZOOM,
        baseLayer: tileLayer,
        controls: [],
        pixelRatio: dpr,
      })
      map.addLayer(selectionLayer)
      map.addLayer(vectorLayer)
      map.addLayer(locMarkerLayer)
      controllerRef.current = controller
      mapInstanceRef.current = map

      // ── Outil de mesure du SDK ───────────────────────────────────
      // Le SDK possède sa propre couche ; on lui donne seulement son zIndex
      // (20 : au-dessus des bornes, sous le marqueur GPS) et son style.
      const traceMesure = new Style({
        stroke: new Stroke({ color: MESURE_COULEUR, width: 2, lineDash: [8, 4] }),
        image: new CircleStyle({
          radius: 5,
          fill: new Fill({ color: MESURE_COULEUR }),
          stroke: new Stroke({ color: '#fff', width: 2 }),
        }),
      })
      const measureTool = controller.createMeasureTool({ style: traceMesure, drawStyle: traceMesure })
      measureTool.layer.setZIndex(20)
      measureToolRef.current = measureTool

      // La longueur est reformatée ici plutôt que d'utiliser `value` du SDK :
      // niceDistance arrondit plus court (« 1.2 km » contre « 1.23 km »), et
      // c'est le format déjà affiché dans l'application.
      measureTool.result$.subscribe(({ feature }: any) => {
        const geom = feature.getGeometry()
        if (geom) setMeasureText(niceDistance(sphereModule.getLength(geom)))
      })

      // ── Indicateur de chargement des tuiles ──────────────────────
      brancherIndicateurTuiles(tileLayer)

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
        const display = clusterByGroup(features, resolution, { getGroupKey: clusterGroupKey, pixelDistance: 40 })
        displaySource.addFeatures(display)

        // Pas de cadrage sur l'étendue des bornes ici : c'est la zone
        // d'intérêt qui commande la vue (effet 3b). Cadrer d'abord sur les
        // données puis sur la zone enchaînerait deux animations contraires.
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
          // L'id est copié sur la display feature par clusterByGroup (voir clusterGroupKey)
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

      // ── Resize : recalcul du canvas OL quand le conteneur change de taille ──
      // Sur mobile, la barre d'adresse se rétracte en scrollant → le div carte
      // change de hauteur SANS déclencher window.resize → OL conserve l'ancien
      // canvas → bandes horizontales grises / tuiles décalées.
      // ResizeObserver cible directement le div cible (mapRef.current).
      const resizeObserver = new ResizeObserver(() => {
        mapInstanceRef.current?.updateSize()
      })
      if (mapRef.current) resizeObserver.observe(mapRef.current)

      // Fallback window.resize (Safari < 13, ou navigation desktop)
      const onWindowResize = () => mapInstanceRef.current?.updateSize()
      window.addEventListener('resize', onWindowResize)

      // Signale que les couches existent. Les effets qui écrivent dedans —
      // le masque de zone en particulier — ont pu s'exécuter pendant les
      // imports dynamiques, alors que les sources valaient encore null ;
      // ce drapeau les fait rejouer une fois la carte prête.
      setMapPrete(true)
    }

    initMap()
    return () => {
      isMounted = false
      // L'outil de mesure possède sa propre couche et son abonnement : il se
      // détruit avant la carte, sinon result$ resterait ouvert.
      measureToolRef.current?.destroy()
      measureToolRef.current = null
      zoneLayerRef.current = null
      if (controllerRef.current) {
        controllerRef.current.destroy()
        controllerRef.current = null
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
        const cluster = olRef.current?.clusterByGroup
        if (cluster) {
          const display = cluster(features, resolution, { getGroupKey: clusterGroupKey, pixelDistance: 40 })
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
    if (!mapInstanceRef.current || !controllerRef.current || !vectorSourceRef.current || !olRef.current) return

    const feature = vectorSourceRef.current.getFeatureById(selectedId)
    if (!feature) return

    const coords = feature.getGeometry()?.getCoordinates?.()
    if (!coords) return

    // ── Fly-to zoom bâtiment (niveau 17 = bâtiments bien visibles) ──
    const currentZoom = mapInstanceRef.current.getView().getZoom() ?? DEFAULT_ZOOM
    controllerRef.current.zoomTo(coords, Math.max(currentZoom, 17), 700)

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

  // ── 3b. Zone d'intérêt : masque, contour et cadrage ───────────

  useEffect(() => {
    const ol  = olRef.current
    const map = mapInstanceRef.current
    if (!ol || !map) return

    const { geoJsonToFeatures, createMaskLayer } = ol

    // La couche entière est reconstruite à chaque changement de zone : le
    // masque dépend de la géométrie, il n'y a rien à conserver d'un rendu au
    // suivant.
    if (zoneLayerRef.current) {
      map.removeLayer(zoneLayerRef.current)
      zoneLayerRef.current = null
    }

    if (!zone?.geometry) return

    // geoJsonToFeatures fait la conversion WGS84 → Web Mercator (et gère
    // Polygon/MultiPolygon) — plus besoin de la projeter anneau par anneau ici.
    const [zoneFeature] = geoJsonToFeatures({ type: 'Feature', properties: {}, geometry: zone.geometry })
    const zoneGeometry = zoneFeature?.getGeometry()
    if (!zoneGeometry) return

    // createMaskLayer assombrit tout ce qui est hors de la géométrie, en
    // gérant lui-même les enclaves (les trous propres à la zone,
    // géographiquement dedans mais administrativement dehors — courant sur un
    // découpage régional) et le sens de rotation des anneaux, sans quoi le
    // trou ne se perce pas et la zone entière est assombrie.
    //
    // zIndex 1 : au-dessus du fond de carte, sous tout le reste. Les bornes,
    // les mesures et le marqueur GPS doivent rester à pleine luminosité même
    // hors de la zone — assombrir une borne la rendrait difficile à
    // distinguer d'une borne détruite.
    const couche = createMaskLayer(zoneGeometry, {
      // 42 % d'opacité : assez pour que l'œil isole immédiatement la zone,
      // assez peu pour que le fond de carte reste lisible à l'extérieur — un
      // géomètre a besoin de voir la route par laquelle il arrive, même
      // quand elle part de l'arrondissement voisin.
      fillColor: 'rgba(14, 27, 34, 0.42)',
      strokeColor: 'rgba(31, 93, 58, 0.9)',
      strokeWidth: 2,
      zIndex: 1,
    })
    // Le masque couvre toute la carte : il ne doit jamais intercepter un clic,
    // sans quoi plus aucune borne ne serait sélectionnable. C'est le
    // `layerFilter` du gestionnaire de clic, restreint à la couche des bornes,
    // qui l'assure — le maintenir en cas d'ajout d'une couche.
    couche.set('nom', 'masque-zone')

    map.addLayer(couche)
    zoneLayerRef.current = couche
  }, [zone, mapPrete])

  /**
   * Ajuste la vue sur l'emprise de la zone d'intérêt.
   *
   * Partagé par le recadrage automatique (au changement de filtre) et par le
   * bouton de la barre d'outils, pour que les deux donnent exactement le
   * même cadrage — un bouton qui recentre autrement que l'affichage initial
   * désoriente plus qu'il n'aide.
   */
  const cadrerSurZone = useCallback((duree = 700) => {
    if (!zone || !controllerRef.current || !olRef.current) return

    const { fromLonLat } = olRef.current
    const [ouest, sud, est, nord] = zone.bbox
    const etendue = [...fromLonLat([ouest, sud]), ...fromLonLat([est, nord])]

    // Marge plus généreuse en bas : les contrôles de carte y sont regroupés
    // sur mobile, et la fiche d'une borne s'ouvre en feuille glissante.
    const surMobile = window.matchMedia('(max-width: 768px)').matches
    const marge: [number, number, number, number] = surMobile
      ? [24, 24, 130, 24]
      : [70, 80, 70, 80]

    // maxZoom : une commune peut être minuscule ; sans plafond, le cadrage
    // plongerait à un zoom où plus aucune tuile n'est disponible.
    controllerRef.current.fitExtent(etendue, marge, { maxZoom: 15, duration: duree })
  }, [zone])

  useEffect(() => {
    if (!zone) return

    // Ne recadrer qu'au changement de zone. Sans cette garde, un simple
    // nouveau rendu ramènerait la vue sur la zone et annulerait le
    // déplacement que l'utilisateur vient de faire à la main.
    const cle = `${zone.niveau}:${zone.nom}`
    if (zoneCadreeRef.current === cle) return
    zoneCadreeRef.current = cle

    cadrerSurZone()
  }, [zone, mapPrete, cadrerSurZone])

  // ── 4. Changement de fond de carte ────────────────────────────

  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !tileLayerRef.current || !olRef.current) return
    const { createOsmBaseLayer, createXyzBaseLayer } = olRef.current

    const url = getBasemapUrl(basemap)
    const nouveau = url
      ? createXyzBaseLayer({ url, ...TUILES_CHARGEMENT })
      : createOsmBaseLayer(TUILES_CHARGEMENT)
    nouveau.setZIndex(0)

    // La couche entière est remplacée, et non sa seule source : les fabriques
    // du SDK rendent une couche complète. C'est aussi ce qui permet de
    // rebrancher l'indicateur de chargement sur la nouvelle source — avec
    // setSource(), les écouteurs restaient attachés à l'ancienne et
    // l'indicateur cessait de réagir dès le premier changement de fond.
    map.removeLayer(tileLayerRef.current)
    map.addLayer(nouveau)
    tileLayerRef.current = nouveau
    brancherIndicateurTuiles(nouveau)
  }, [basemap, brancherIndicateurTuiles])

  // ── 5. Outil mesure (MeasureTool du SDK) ──────────────────────

  useEffect(() => {
    const outil = measureToolRef.current
    if (!outil) return

    if (activeTool !== 'measure') {
      outil.deactivate()
      outil.clear()
      setMeasureText(null)
      return
    }

    outil.clear()
    setMeasureText(null)
    try {
      outil.activate('LineString')
    } catch {
      // MapCapabilityError : le rôle courant n'a pas la capacité 'measure'.
      // La garde vit dans le SDK, donc elle tient même si le bouton est
      // atteint autrement que par l'interface.
      setActiveTool('pan')
      setMeasureText(null)
      return
    }

    return () => outil.deactivate()
  }, [activeTool, mapPrete])

  // ── 6. Géolocalisation ────────────────────────────────────────

  const handleLocate = useCallback(() => {
    if (!mapInstanceRef.current || !controllerRef.current || !olRef.current) return
    if (!navigator.geolocation) { setGeoErreur('indisponible'); return }

    setLocating(true)
    setGeoErreur(null)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { fromLonLat, OlFeature, OlPoint, OlCircleGeom, Style, OlIcon, Stroke, Fill } = olRef.current
        const center = fromLonLat([pos.coords.longitude, pos.coords.latitude])

        // Centrer + zoomer
        controllerRef.current.zoomTo(center, 16, 800)

        // Placer / déplacer le marqueur de position
        if (locMarkerSourceRef.current) {
          locMarkerSourceRef.current.clear()

          // Cercle de précision, tracé avant le marqueur pour passer dessous.
          //
          // `accuracy` est le rayon en mètres du cercle de confiance à 68 %
          // annoncé par le navigateur. Il va de quelques mètres avec un vrai
          // GPS à plusieurs kilomètres en triangulation réseau. Le montrer
          // est indispensable ici : sans lui, un point bleu posé à 2 km de la
          // position réelle a exactement la même apparence qu'un point juste,
          // et un géomètre qui cherche une borne partirait dans la mauvaise
          // direction en toute confiance.
          //
          // Le rayon est exprimé en mètres alors que la vue est en EPSG:3857,
          // dont l'unité s'étire avec la latitude. Le Cameroun s'étend de 2°
          // à 13° N, où le facteur d'échelle va de 1,00 à 1,03 : l'écart reste
          // sous 3 %, négligeable pour un indicateur d'incertitude.
          const precision = pos.coords.accuracy
          if (precision && precision > 0) {
            const cercle = new OlFeature(new OlCircleGeom(center, precision))
            cercle.setStyle(new Style({
              fill:   new Fill({ color: 'rgba(66,133,244,0.12)' }),
              stroke: new Stroke({ color: 'rgba(66,133,244,0.40)', width: 1 }),
            }))
            locMarkerSourceRef.current.addFeature(cercle)
          }

          const locFeature = new OlFeature({ geometry: new OlPoint(center) })
          locFeature.setStyle(new Style({
            image: new OlIcon({ src: makeLocMarkerSvg(), anchor: [0.5, 0.5] }),
          }))
          locMarkerSourceRef.current.addFeature(locFeature)
        }

        setLocating(false)
      },
      (err) => {
        setLocating(false)
        setGeoErreur(err.code === err.PERMISSION_DENIED ? 'refuse' : 'indisponible')
      },
      // enableHighAccuracy : le GPS du téléphone plutôt que la triangulation
      // réseau, qui peut se tromper de plusieurs kilomètres. Le délai est
      // porté à 15 s — une première acquisition GPS à froid, sous couvert
      // forestier, dépasse couramment 10 s. maximumAge accepte un relevé de
      // moins de 30 s, ce qui évite de refaire une acquisition complète quand
      // la liste vient déjà de localiser l'utilisateur.
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
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

  /**
   * Repli quand la zone d'intérêt n'a pas pu être chargée.
   *
   * `CAMEROON_CENTER` et `DEFAULT_ZOOM` sont deux constantes figées : elles
   * ne tiennent compte ni du filtre administratif courant, ni du format de
   * l'écran, et sur un téléphone en portrait le pays débordait largement du
   * cadre. C'est pourquoi ce n'est plus le comportement du bouton, mais son
   * dernier recours.
   */
  const centrerParDefaut = useCallback(() => {
    if (!controllerRef.current || !olRef.current) return
    const { fromLonLat } = olRef.current
    controllerRef.current.zoomTo(fromLonLat(CAMEROON_CENTER), DEFAULT_ZOOM, 600)
  }, [])

  const recadrer = useCallback(() => {
    if (zone) cadrerSurZone(600)
    else centrerParDefaut()
  }, [zone, cadrerSurZone, centrerParDefaut])

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

      {/* Échec de géolocalisation.
          role="alert" : le bandeau apparaît à distance du bouton qui l'a
          déclenché, un lecteur d'écran ne le signalerait pas autrement. */}
      {geoErreur && (
        <div className="geo-error-strip" role="alert">
          <Icon name="triangle-alert" size={14} />
          <span>
            {geoErreur === 'refuse'
              ? t('map.geo.refuse')
              : t('map.geo.introuvable')}
          </span>
          <button
            type="button"
            onClick={() => setGeoErreur(null)}
            className="geo-error-close"
            aria-label={t('map.geo.fermer')}
          >
            <Icon name="x" size={13} />
          </button>
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

      {/* ── Barre d'outils (colonne, haut-droite) ── */}
      <div className="map-toolbar">

        {/* Filtres — mobile seulement.
            Sur grand écran le panneau reste déplié à gauche ; sur mobile il
            est replié, et son seul accès était une icône muette de 32 px
            noyée parmi quatre autres dans le header.

            L'icône annonce le geste plutôt que la fonction : chevrons vers
            la droite quand le panneau est fermé — il va sortir par la
            gauche — et vers la gauche quand il est ouvert, pour le renvoyer
            d'où il vient. Une icône d'entonnoir fixe dirait « filtres »
            sans rien dire de ce que fait le clic. */}
        {onBasculerFiltres && (
          <button
            className={`map-tool-btn map-tool-filtres${filtresOuverts ? ' ouvert' : ''}`}
            onClick={onBasculerFiltres}
            aria-expanded={filtresOuverts}
            title={filtresOuverts ? t('header.filtres.hide') : t('header.filtres.show')}
            aria-label={
              nbFiltresActifs > 0
                ? `${filtresOuverts ? t('header.filtres.hide') : t('header.filtres.show')} — ${nbFiltresActifs}`
                : (filtresOuverts ? t('header.filtres.hide') : t('header.filtres.show'))
            }
          >
            <Icon name={filtresOuverts ? 'panel-left-close' : 'panel-left-open'} size={17} />
            {nbFiltresActifs > 0 && (
              <span className="map-tool-pastille" aria-hidden="true">{nbFiltresActifs}</span>
            )}
          </button>
        )}

        {/* Détache les filtres — qui pilotent un panneau — des outils qui
            agissent sur la carte. Masqué avec le bouton sur grand écran,
            sans quoi la colonne s'ouvrirait sur un trait orphelin. */}
        <div className="map-tool-sep map-tool-sep-filtres" />

        {/* Pan */}
        <button
          className={`map-tool-btn map-tool-pan${activeTool === 'pan' ? ' active' : ''}`}
          title={t('map.outil.pan')}
          onClick={() => setActiveTool('pan')}
        >
          <Icon name="navigate" size={17} />
        </button>

        {/* Mesure */}
        <button
          className={`map-tool-btn map-tool-mesure${activeTool === 'measure' ? ' active' : ''}`}
          title={t('map.outil.mesurer')}
          onClick={() => setActiveTool((t) => t === 'measure' ? 'pan' : 'measure')}
        >
          <Icon name="ruler" size={17} />
        </button>

        <div className="map-tool-sep" />

        {/* Sélecteur de fond de carte.
            Le conteneur porte la classe d'ordonnancement, et non le bouton :
            c'est lui qui est l'enfant direct de la barre, donc le seul que
            la propriété `order` puisse déplacer. */}
        <div className="map-tool-couches-wrap" style={{ position: 'relative' }}>
          <button
            className={`map-tool-btn map-tool-couches${showBasemapPicker ? ' active' : ''}`}
            title={t('map.fond')}
            onClick={() => setShowBasemapPicker((v) => !v)}
          >
            <Icon name="layers" size={17} />
          </button>

          {showBasemapPicker && (
            <div className="basemap-picker">
              <div className="basemap-picker-title">
                {t('map.fond')}
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
          className={`map-tool-btn map-tool-gps${locating ? ' active' : ''}`}
          title={t('map.geo.ma_position')}
          aria-label={t('map.geo.afficher')}
          onClick={handleLocate}
        >
          <Icon name={locating ? 'loader' : 'crosshair'} size={17}
            style={locating ? { animation: 'spin 1s linear infinite' } : undefined} />
        </button>

        {/* Centrer Cameroun */}
        <button
          className="map-tool-btn map-tool-cadrer"
          title={zone ? `${t('map.cadrer_zone')} — ${zone.nom}` : t('map.centrer_pays')}
          aria-label={zone ? `${t('map.cadrer_zone')} — ${zone.nom}` : t('map.centrer_pays')}
          onClick={recadrer}
        >
          <Icon name="maximize-2" size={17} />
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
            — {t('map.mesure.fin')}
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
          {t('map.mesure.aide')}
        </div>
      )}

      {/* ── Légende (bas-gauche) ── */}
      <div className="map-legend">
        <div className="legend-title">
          {t('map.legende')}
        </div>

        {/* ─ Ordre réseau — forme = ordre, couleur = statut ─ */}
        <div className="legend-section-label">
          {t('map.legende.ordre')}
        </div>
        {([
          { o: 1, label: t('map.ordre.1'),   sub: t('map.ordre.1.sub') },
          { o: 2, label: t('map.ordre.2'),   sub: t('map.ordre.2.sub')        },
          { o: 3, label: t('map.ordre.3'),   sub: t('map.ordre.3.sub')    },
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
          {t('map.legende.couleur')}
        </div>
        {[
          { color: '#1F5D3A', label: t('map.statut.actif')  },
          { color: '#D4A017', label: t('map.statut.degrade')},
          { color: '#B83434', label: t('map.statut.detruit')           },
          { color: '#9BA5AC', label: t('map.statut.inconnu')             },
          { color: '#B85729', label: t('map.statut.selection')            },
        ].map(({ color, label }) => (
          <div key={color} className="legend-item">
            <span className="legend-dot" style={{ background: color }} />
            <span style={{ fontSize: 11 }}>{label}</span>
          </div>
        ))}

        {/* ─ Position utilisateur ─ */}
        <div className="legend-section-label" style={{ marginTop: 8 }}>
          {t('map.geo.ma_position')}
        </div>
        <div className="legend-item">
          <span style={{
            width: 13, height: 13, borderRadius: '50%', flexShrink: 0,
            background: 'rgba(66,133,244,0.25)', border: '2px solid #4285F4',
            display: 'inline-block',
          }} />
          <span style={{ fontSize: 11 }}>{t('map.legende.gps')}</span>
        </div>
      </div>
    </div>
  )
}
