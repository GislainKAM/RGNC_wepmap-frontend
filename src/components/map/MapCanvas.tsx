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
const SELECTED_COLOR = '#B85729'

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

function makeSvgMarker(ordre: number, color: string, selected: boolean): string {
  const size   = selected ? 20 : 15
  const stroke = selected ? '#fff' : 'rgba(255,255,255,0.85)'
  const sw     = selected ? 2.5 : 1.8

  let shape: string
  if (ordre === 1) {
    // Triangle géodésique avec croix intérieure
    shape = `
      <polygon points="${size/2},2 ${size-2},${size-2} 2,${size-2}"
        fill="${color}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>
      <line x1="${size/2}" y1="${size*0.52}" x2="${size/2}" y2="${size*0.76}"
        stroke="${stroke}" stroke-width="1.1" stroke-linecap="round"/>
      <line x1="${size*0.36}" y1="${size*0.64}" x2="${size*0.64}" y2="${size*0.64}"
        stroke="${stroke}" stroke-width="1.1" stroke-linecap="round"/>
      <circle cx="${size/2}" cy="${size*0.64}" r="${size*0.12}" fill="${stroke}"/>`
  } else if (ordre === 2) {
    // Losange avec point central
    const h = size / 2
    shape = `
      <polygon points="${h},1.5 ${size-1.5},${h} ${h},${size-1.5} 1.5,${h}"
        fill="${color}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>
      <circle cx="${h}" cy="${h}" r="${size*0.16}" fill="${stroke}"/>`
  } else {
    // Cercle avec anneau intérieur
    const cx = size / 2, cy = size / 2
    const r  = size / 2 - 1.8
    shape = `
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" stroke="${stroke}" stroke-width="${sw}"/>
      <circle cx="${cx}" cy="${cy}" r="${size*0.18}" fill="${stroke}"/>`
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${shape}</svg>`
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}

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
  const mapRef          = useRef<HTMLDivElement>(null)
  const mapInstanceRef  = useRef<any>(null)
  const vectorSourceRef = useRef<any>(null)
  const vectorLayerRef  = useRef<any>(null)
  const tileLayerRef    = useRef<any>(null)
  const olRef             = useRef<any>(null)          // modules OL mis en cache après init
  const measureSourceRef  = useRef<any>(null)
  const drawInteractionRef = useRef<any>(null)
  const locMarkerSourceRef = useRef<any>(null)          // source pour le marqueur GPS utilisateur

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
        { Style, Icon: OlIcon, Stroke, Fill, Circle: CircleStyle },
        { fromLonLat, toLonLat },
        { default: Draw      },
        sphereModule,
        { default: OlFeature },
        { default: OlPoint   },
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
      ])

      if (!isMounted || !mapRef.current) return

      // Cache les modules pour utilisation ultérieure
      olRef.current = {
        OlMap, View, TileLayer, OSM, XYZ,
        VectorLayer, VectorSource, GeoJSON,
        Style, OlIcon, Stroke, Fill, CircleStyle,
        fromLonLat, toLonLat,
        Draw, OlFeature, OlPoint,
        getLength: sphereModule.getLength,
      }

      // Source vecteur — points géodésiques
      const vectorSource = new VectorSource({ format: new GeoJSON() })
      vectorSourceRef.current = vectorSource

      // Source vecteur — mesures
      const measureSource = new VectorSource()
      measureSourceRef.current = measureSource

      // Style des marqueurs
      const vectorLayer = new VectorLayer({
        source: vectorSource,
        zIndex: 10,
        style: (feature: any) => {
          const props    = feature.getProperties()
          const ordre    = props.ordre  ?? 3
          const statut   = props.statut ?? 'inconnu'
          const fid      = feature.getId()
          const isSel    = fid === selectedId
          const color    = isSel ? SELECTED_COLOR : (STATUT_COLORS[statut] ?? '#9BA5AC')
          return new Style({
            image: new OlIcon({ src: makeSvgMarker(ordre, color, isSel), anchor: [0.5, 0.5] }),
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

      // Fond de carte OSM par défaut
      const tileLayer = new TileLayer({ source: new OSM(), zIndex: 0 })
      tileLayerRef.current = tileLayer

      // Initialisation de la carte
      const map = new OlMap({
        target: mapRef.current!,
        layers: [tileLayer, measureLayer, vectorLayer, locMarkerLayer],
        view: new View({
          center: fromLonLat(CAMEROON_CENTER),
          zoom: DEFAULT_ZOOM,
          minZoom: MIN_ZOOM,
          maxZoom: MAX_ZOOM,
        }),
        controls: [],
      })
      mapInstanceRef.current = map

      // Clic → sélection du point
      map.on('click', (evt: any) => {
        const feature = map.forEachFeatureAtPixel(evt.pixel, (f: any) => f, {
          layerFilter: (l: any) => l === vectorLayer,
        })
        if (feature) {
          const id = feature.getId() as number
          if (id != null) onPickPoint(id)
        }
      })

      // Pointermove → curseur + coordonnées
      map.on('pointermove', (evt: any) => {
        if (evt.dragging) return
        const hit = map.hasFeatureAtPixel(evt.pixel, {
          layerFilter: (l: any) => l === vectorLayer,
        })
        map.getTargetElement().style.cursor = hit ? 'pointer' : ''

        const [lon, lat] = toLonLat(evt.coordinate)
        setCursorCoords([lon, lat])
      })

      // Moveend → zoom + barre d'échelle
      const updateZoomScale = () => {
        const view       = map.getView()
        const z          = view.getZoom() ?? DEFAULT_ZOOM
        const resolution = view.getResolution() ?? 1
        setCurrentZoom(z)
        // 72 px × resolution m/px = longueur de la barre
        setScaleLabel(niceDistance(72 * resolution))
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

  // ── 2. Mise à jour des entités (points) ───────────────────────

  useEffect(() => {
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
    }
    updateFeatures()
  }, [points])

  // ── 3. Fly-to sur sélection ───────────────────────────────────

  useEffect(() => {
    if (!mapInstanceRef.current || selectedId == null || !vectorSourceRef.current) return
    const feature = vectorSourceRef.current.getFeatureById(selectedId)
    if (!feature) return
    const coords = feature.getGeometry()?.getCoordinates?.()
    if (!coords) return
    const view = mapInstanceRef.current.getView()
    view.animate({ center: coords, zoom: Math.max(view.getZoom() ?? DEFAULT_ZOOM, 12), duration: 600 })
    vectorLayerRef.current?.changed()
  }, [selectedId])

  useEffect(() => {
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
