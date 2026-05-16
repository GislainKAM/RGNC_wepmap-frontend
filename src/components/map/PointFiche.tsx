'use client'

import React, { useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { Badge, StatutBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { OrdreIcon } from '@/components/ui/OrdreIcon'
import { SignalementModal } from '@/components/map/SignalementModal'
import { usePointDetail, useFicheSignaletique, useHistoriqueStatuts } from '@/hooks/useGeodeticPoints'
import { useAuth } from '@/hooks/useAuth'
import { useLanguage } from '@/hooks/useLanguage'
import { pointApi } from '@/lib/api'
import { API_URL } from '@/lib/constants'
import { format } from 'date-fns'
import { fr as frLocale, enUS } from 'date-fns/locale'

type Tab = 'coordonnees' | 'croquis' | 'historique' | 'documents'

interface PointFicheProps {
  pointId: number | null
  onClose: () => void
  onToast?: (msg: string, type: 'success' | 'warning' | 'danger' | 'info') => void
}

function CroquisSVG() {
  return (
    <svg viewBox="0 0 300 200" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
      <rect width="300" height="200" fill="#EDE8DC" />
      {/* Grid lines */}
      {[0, 50, 100, 150, 200, 250, 300].map((x) => (
        <line key={x} x1={x} y1="0" x2={x} y2="200" stroke="#D0C9B8" strokeWidth="0.5" />
      ))}
      {[0, 50, 100, 150, 200].map((y) => (
        <line key={y} x1="0" y1={y} x2="300" y2={y} stroke="#D0C9B8" strokeWidth="0.5" />
      ))}
      {/* Borne marker */}
      <circle cx="150" cy="100" r="12" fill="#1F5D3A" stroke="white" strokeWidth="2" />
      <polygon points="150,82 165,115 135,115" fill="#B85729" opacity="0.7" />
      <text x="150" y="140" textAnchor="middle" fill="#26343C" fontSize="11" fontFamily="monospace">Point P</text>
      {/* Compass */}
      <text x="280" y="20" textAnchor="middle" fill="#5A6770" fontSize="12" fontWeight="bold">N</text>
      <line x1="280" y1="22" x2="280" y2="35" stroke="#5A6770" strokeWidth="1.5" markerEnd="url(#arrow)" />
      {/* Scale */}
      <rect x="10" y="180" width="60" height="4" fill="#26343C" />
      <text x="40" y="195" textAnchor="middle" fill="#26343C" fontSize="9" fontFamily="monospace">50 m</text>
    </svg>
  )
}

export function PointFiche({ pointId, onClose, onToast }: PointFicheProps) {
  const [activeTab,        setActiveTab]        = useState<Tab>('coordonnees')
  const [showSignalement,  setShowSignalement]  = useState(false)
  const isAuth = useAuth((s) => s.isAuthenticated)
  const { t, lang } = useLanguage()
  const dateLocale = lang === 'fr' ? frLocale : enUS

  const { data: point, isLoading } = usePointDetail(pointId)
  const { data: fiche }            = useFicheSignaletique(pointId)
  const { data: historique }       = useHistoriqueStatuts(pointId)

  if (pointId === null) return null

  const handleShare = () => {
    const url = `${window.location.origin}/map?point=${pointId}`
    navigator.clipboard.writeText(url).then(() => {
      onToast?.(t('fiche.toast.copie'), 'success')
    })
  }

  const handleDownload = () => {
    if (!isAuth) {
      onToast?.(t('fiche.toast.login'), 'warning')
      return
    }
    const url = pointApi.urlTelechargement(pointId)
    window.open(url, '_blank')
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'coordonnees', label: t('fiche.tab.coords')     },
    { key: 'croquis',     label: t('fiche.tab.croquis')    },
    { key: 'historique',  label: t('fiche.tab.historique') },
    { key: 'documents',   label: t('fiche.tab.documents')  },
  ]

  return (
    <div className="fiche-panel" role="complementary" aria-label="Fiche du point géodésique">
      {/* Header */}
      <div className="fiche-header">
        <div className="fiche-header-top">
          <div style={{ flex: 1, minWidth: 0 }}>
            {isLoading ? (
              <div className="fiche-id" style={{ height: 14, background: 'var(--bg-sunken)', borderRadius: 3, width: 80 }} />
            ) : (
              <>
                <div className="fiche-id">
                  #{point?.matricule ?? '—'}
                </div>
                <h2 className="fiche-name">{point?.nom ?? 'Chargement…'}</h2>
                {point && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                    <StatutBadge statut={point.statut} />
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--fg-3)' }}>
                      <OrdreIcon ordre={point.ordre} size={13} color={
                        point.statut === 'actif'   ? '#1F5D3A' :
                        point.statut === 'degrade' ? '#D4A017' :
                        point.statut === 'detruit' ? '#B83434' : '#9BA5AC'
                      } />
                      {point.ordre_label}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
          <button className="fiche-close-btn" onClick={onClose} aria-label="Fermer la fiche">
            <Icon name="x" size={15} />
          </button>
        </div>

        {/* Tabs */}
        <div className="fiche-tabs" role="tablist">
          {tabs.map((t) => (
            <button
              key={t.key}
              className={`fiche-tab${activeTab === t.key ? ' active' : ''}`}
              onClick={() => setActiveTab(t.key)}
              role="tab"
              aria-selected={activeTab === t.key}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="fiche-body">
        {/* Coordonnées tab */}
        {activeTab === 'coordonnees' && (
          <div className="fiche-tab-content">
            {isLoading ? (
              <div style={{ color: 'var(--fg-3)', fontSize: 13, textAlign: 'center', paddingTop: 32 }}>
                {t('fiche.loading')}
              </div>
            ) : point ? (
              <>
                {/* Localisation */}
                <div>
                  <p className="fiche-section-title">{t('fiche.section.localisation')}</p>
                  <div className="fiche-kv">
                    <div className="fiche-kv-item">
                      <div className="k">{t('fiche.kv.region')}</div>
                      <div className="v body">{point.region_nom ?? '—'}</div>
                    </div>
                    <div className="fiche-kv-item">
                      <div className="k">{t('fiche.kv.dept')}</div>
                      <div className="v body">{point.departement_nom ?? '—'}</div>
                    </div>
                    <div className="fiche-kv-item">
                      <div className="k">{t('fiche.kv.commune')}</div>
                      <div className="v body">{point.commune_nom ?? '—'}</div>
                    </div>
                    <div className="fiche-kv-item">
                      <div className="k">{t('fiche.kv.localite')}</div>
                      <div className="v body">{point.localite || '—'}</div>
                    </div>
                  </div>
                </div>

                {/* Coordonnées géographiques */}
                <div>
                  <p className="fiche-section-title">{t('fiche.section.coords_geo')}</p>
                  <div className="fiche-kv">
                    <div className="fiche-kv-item">
                      <div className="k">{t('fiche.kv.lat_dd')}</div>
                      <div className="v">{point.latitude_dd.toFixed(8)}°</div>
                    </div>
                    <div className="fiche-kv-item">
                      <div className="k">{t('fiche.kv.lon_dd')}</div>
                      <div className="v">{point.longitude_dd.toFixed(8)}°</div>
                    </div>
                    <div className="fiche-kv-item">
                      <div className="k">{t('fiche.kv.lat_dms')}</div>
                      <div className="v">{point.latitude_dms || '—'}</div>
                    </div>
                    <div className="fiche-kv-item">
                      <div className="k">{t('fiche.kv.lon_dms')}</div>
                      <div className="v">{point.longitude_dms || '—'}</div>
                    </div>
                  </div>
                </div>

                {/* Coordonnées UTM */}
                <div>
                  <p className="fiche-section-title">{t('fiche.section.coords_utm')}</p>
                  <div className="fiche-kv">
                    <div className="fiche-kv-item">
                      <div className="k">{t('fiche.kv.est')}</div>
                      <div className="v">{point.easting_utm != null ? point.easting_utm.toFixed(3) + ' m' : '—'}</div>
                    </div>
                    <div className="fiche-kv-item">
                      <div className="k">{t('fiche.kv.nord')}</div>
                      <div className="v">{point.northing_utm != null ? point.northing_utm.toFixed(3) + ' m' : '—'}</div>
                    </div>
                    <div className="fiche-kv-item">
                      <div className="k">{t('fiche.kv.zone_utm')}</div>
                      <div className="v">{point.zone_utm || '—'}</div>
                    </div>
                    <div className="fiche-kv-item">
                      <div className="k">{t('fiche.kv.epsg')}</div>
                      <div className="v">EPSG:{point.epsg_code}</div>
                    </div>
                  </div>
                </div>

                {/* Altitudes */}
                <div>
                  <p className="fiche-section-title">{t('fiche.section.altimetrie')}</p>
                  <div className="fiche-kv">
                    <div className="fiche-kv-item">
                      <div className="k">{t('fiche.kv.alt_ngac')}</div>
                      <div className="v">{point.altitude_ngac != null ? point.altitude_ngac.toFixed(3) + ' m' : '—'}</div>
                    </div>
                    <div className="fiche-kv-item">
                      <div className="k">{t('fiche.kv.alt_ellips')}</div>
                      <div className="v">{point.altitude_ellipsoidale != null ? point.altitude_ellipsoidale.toFixed(3) + ' m' : '—'}</div>
                    </div>
                    <div className="fiche-kv-item">
                      <div className="k">{t('fiche.kv.ondulation')}</div>
                      <div className="v">{point.ondulation_geoidale != null ? point.ondulation_geoidale.toFixed(3) + ' m' : '—'}</div>
                    </div>
                  </div>
                </div>

                {/* Matérialisation */}
                <div>
                  <p className="fiche-section-title">{t('fiche.section.materialisation')}</p>
                  <div className="fiche-matter-card">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/assets/icons/${
                        point.reseau === 'PAMOCCA'   ? 'pilier-geodesique'   :
                        point.reseau === 'AUTRE'     ? 'repere-nivellement'  :
                        point.reseau.startsWith('DENSIF') ? 'borne-beton'   :
                        'pilier-geodesique'
                      }.svg`}
                      alt={point.reseau_label}
                      style={{ width: 28, height: 28, opacity: 0.85, filter: 'sepia(0.4) saturate(0.8)' }}
                    />
                    <div>
                      <div className="fiche-matter-label">
                        {point.reseau === 'PAMOCCA'          ? t('fiche.mat.pilier') :
                         point.reseau === 'AUTRE'            ? t('fiche.mat.repere') :
                         point.reseau.startsWith('DENSIF')   ? t('fiche.mat.borne')  :
                         t('fiche.mat.pilier')}
                      </div>
                      <div className="fiche-matter-sub">{point.reseau_label} · {point.systeme_reference}</div>
                    </div>
                  </div>
                </div>

                {/* Description */}
                {point.description_acces && (
                  <div>
                    <p className="fiche-section-title">{t('fiche.section.acces')}</p>
                    <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--fg-2)', lineHeight: 1.6 }}>
                      {point.description_acces}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div style={{ color: 'var(--fg-3)', fontSize: 13, textAlign: 'center', paddingTop: 32 }}>
                {t('fiche.notfound')}
              </div>
            )}
          </div>
        )}

        {/* Croquis / Photo tab */}
        {activeTab === 'croquis' && (
          <div className="fiche-tab-content">
            {point?.photo_url ? (
              <>
                {/* Photo terrain réelle */}
                <a
                  href={point.photo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={lang === 'fr' ? 'Ouvrir en grand' : 'Open full size'}
                  style={{ display: 'block', textDecoration: 'none' }}
                >
                  <div className="fiche-photo fiche-photo--real">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={point.photo_url}
                      alt={`Photo de la borne ${point.matricule}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                    {/* Overlay "agrandir" */}
                    <div className="fiche-photo-overlay">
                      <Icon name="maximize-2" size={18} color="#fff" />
                    </div>
                  </div>
                </a>
                <p style={{ fontSize: 11, color: 'var(--fg-4)', textAlign: 'center', marginTop: 6 }}>
                  <Icon name="camera" size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                  {lang === 'fr' ? 'Photo terrain · cliquer pour agrandir' : 'Field photo · click to enlarge'}
                </p>
              </>
            ) : (
              <>
                {/* Croquis SVG générique si pas de photo */}
                <div className="fiche-photo">
                  <CroquisSVG />
                </div>
                <p style={{ fontSize: 11, color: 'var(--fg-4)', textAlign: 'center', marginTop: 6 }}>
                  {lang === 'fr'
                    ? 'Aucune photo disponible — croquis de localisation'
                    : 'No photo available — location sketch'}
                </p>
              </>
            )}
          </div>
        )}

        {/* Historique tab */}
        {activeTab === 'historique' && (
          <div className="fiche-tab-content">
            <p className="fiche-section-title">{t('fiche.section.historique')}</p>
            {historique && historique.length > 0 ? (
              <div className="fiche-history">
                {historique.map((h) => (
                  <div key={h.id} className="history-item">
                    <div className="history-date">
                      {h.date ? format(new Date(h.date), 'dd MMM yyyy', { locale: dateLocale }) : '—'}
                    </div>
                    <div>
                      <div className="history-desc">
                        Statut : <strong>{h.statut_label}</strong>
                        {h.notes && <> — {h.notes}</>}
                      </div>
                      {h.verifie_par_nom && (
                        <div className="history-by">{t('fiche.historique.par')} {h.verifie_par_nom}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--fg-3)', fontSize: 13 }}>{t('fiche.historique.empty')}</p>
            )}
          </div>
        )}

        {/* Documents tab */}
        {activeTab === 'documents' && (
          <div className="fiche-tab-content">
            <p className="fiche-section-title">{t('fiche.section.pdf')}</p>
            {fiche ? (
              <div className="fiche-doc-item" onClick={handleDownload}>
                <Icon name="file-text" size={20} style={{ color: 'var(--rgnc-foret-700)', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div className="fiche-doc-name">Fiche_{point?.matricule}.pdf</div>
                  <div className="fiche-doc-meta">
                    v{fiche.version} · {fiche.taille_ko} Ko · {format(new Date(fiche.date_upload), 'dd/MM/yyyy', { locale: dateLocale })}
                  </div>
                </div>
                <Icon name="download" size={15} style={{ color: 'var(--fg-3)', flexShrink: 0 }} />
              </div>
            ) : (
              <p style={{ color: 'var(--fg-3)', fontSize: 13 }}>{t('fiche.doc.aucun')}</p>
            )}

            {!isAuth && (
              <div style={{
                background: 'var(--rgnc-warning-bg)',
                border: '1px solid #E0BE5C',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 12px',
                fontSize: 12,
                color: '#5C4708',
                display: 'flex',
                gap: 8,
                alignItems: 'center',
              }}>
                <Icon name="info" size={14} />
                {t('fiche.doc.login')}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="fiche-footer">
        <Button variant="ghost" size="sm" onClick={handleShare}>
          <Icon name="share" size={13} />
          {t('fiche.btn.partager')}
        </Button>
        <Button variant="secondary" size="sm" style={{ flex: 1 }} onClick={handleDownload} disabled={!fiche}>
          <Icon name="download" size={13} />
          {t('fiche.btn.pdf')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowSignalement(true)}
        >
          <Icon name="triangle-alert" size={13} />
          {t('fiche.btn.signaler')}
        </Button>
      </div>

      {/* Modale de signalement — montée en dehors du panel pour z-index correct */}
      {showSignalement && pointId != null && (
        <SignalementModal
          pointId={pointId}
          pointMatricule={point?.matricule}
          onClose={() => setShowSignalement(false)}
          onSuccess={() => {
            setShowSignalement(false)
            onToast?.(t('signal.success'), 'success')
          }}
        />
      )}
    </div>
  )
}
