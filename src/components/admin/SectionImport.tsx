'use client'

import React, { useRef, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { useLanguage } from '@/hooks/useLanguage'
import { useImportBornes } from '@/hooks/useAdmin'
import { importApi } from '@/lib/api'
import type { ImportResult } from '@/lib/types'
import { ApiError } from './AdminUI'
import type { ToastType } from './adminUtils'

// ── Types locaux ──────────────────────────────────────────────────────────────

type ImportStep = 'idle' | 'uploading' | 'done' | 'error'

// ── SectionImport ─────────────────────────────────────────────────────────────

export function SectionImport({ onToast }: { onToast: (m: string, t?: ToastType) => void }) {
  const { t } = useLanguage()
  const [step,     setStep]     = useState<ImportStep>('idle')
  const [file,     setFile]     = useState<File | null>(null)
  const [result,   setResult]   = useState<ImportResult | null>(null)
  const [errMsg,   setErrMsg]   = useState('')
  const [dragging, setDragging] = useState(false)
  const importMut = useImportBornes()
  const fileRef   = useRef<HTMLInputElement>(null)

  const pickFile = (f: File | null | undefined) => {
    if (!f) return
    setFile(f); setStep('idle'); setResult(null); setErrMsg('')
  }

  const handleUpload = async () => {
    if (!file) return
    setStep('uploading')
    try {
      const res = await importMut.mutateAsync(file)
      setResult(res); setStep('done')
      onToast(`${t('admin.import.rapport')} : ${res.importees} ${t('admin.import.importees')}.`, 'success')
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || t('admin.import.erreur')
      setErrMsg(msg); setStep('error')
      onToast(msg, 'danger')
    }
  }

  const reset = () => { setStep('idle'); setFile(null); setResult(null); setErrMsg('') }

  const stepIdx = step === 'idle' ? (file ? 1 : 0) : step === 'uploading' || step === 'done' || step === 'error' ? 2 : 0
  const stepsUI = [
    { n: '1', label: t('admin.import.step1') },
    { n: '2', label: t('admin.import.step2') },
    { n: '3', label: t('admin.import.step3') },
  ]

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, margin: 0 }}>{t('admin.title.import')}</h2>
        <span style={{ fontSize: 13, color: 'var(--fg-3)' }}>{t('admin.import.subtitle')}</span>
      </div>

      {/* Stepper */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 28 }}>
        {stepsUI.map(({ n, label }, i) => {
          const done   = i < stepIdx
          const active = i === stepIdx
          return (
            <React.Fragment key={n}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, background: done || active ? 'var(--rgnc-foret-700)' : 'var(--bg-sunken)', color: done || active ? '#fff' : 'var(--fg-3)', border: `2px solid ${done || active ? 'var(--rgnc-foret-700)' : 'var(--border-subtle)'}` }}>
                  {done ? <Icon name="check" size={13} color="#fff" strokeWidth={2.5} /> : n}
                </div>
                <span style={{ fontSize: 13, fontWeight: active ? 600 : 400, color: active ? 'var(--rgnc-foret-700)' : done ? 'var(--fg-2)' : 'var(--fg-3)' }}>{label}</span>
              </div>
              {i < 2 && <div style={{ width: 36, height: 1, background: 'var(--border-subtle)', margin: '0 8px' }} />}
            </React.Fragment>
          )
        })}
      </div>

      {/* Étape 1 — sélection */}
      {(step === 'idle' && !file) && (
        <div className="admin-import-grid" style={{ display: 'grid', gap: 16 }}>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files[0]) }}
            onClick={() => fileRef.current?.click()}
            className="admin-dropzone"
            style={{ border: `2px dashed ${dragging ? 'var(--rgnc-foret-700)' : 'var(--border-subtle)'}`, borderRadius: 'var(--radius-md)', background: dragging ? 'var(--rgnc-foret-50)' : 'var(--bg-surface)', padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, cursor: 'pointer', transition: 'all 150ms' }}>
            <input ref={fileRef} type="file" accept=".csv,.json,.geojson,.pdf" style={{ display: 'none' }} onChange={(e) => pickFile(e.target.files?.[0])} />
            <div style={{ width: 64, height: 64, borderRadius: 'var(--radius-md)', border: '2px dashed var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-elevated)' }}>
              <Icon name="arrow-right" size={28} color="var(--fg-3)" style={{ transform: 'rotate(-90deg)' }} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg-1)', marginBottom: 6 }}>{t('admin.import.glisser')}</div>
              <div style={{ fontSize: 13, color: 'var(--fg-3)' }}>{t('admin.import.cliquer')}</div>
              <div style={{ fontSize: 12, color: 'var(--fg-4)', marginTop: 6 }}>{t('admin.import.formats_max')}</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="admin-card">
              <div className="admin-card-head"><h3>{t('admin.import.formats_titre')}</h3></div>
              <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { fmt: 'CSV',  col: 'var(--rgnc-success)', desc: 'Modèle MINDCAF — colonnes requises' },
                  { fmt: 'PDF',  col: 'var(--rgnc-danger)',  desc: 'Fiches scannées — OCR côté serveur' },
                  { fmt: 'JSON', col: 'var(--rgnc-info)',    desc: 'GeoJSON WGS84 — export QGIS' },
                ].map(({ fmt, col, desc }) => (
                  <div key={fmt} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, background: 'var(--bg-sunken)', color: col, padding: '2px 7px', borderRadius: 'var(--radius-xs)', flexShrink: 0 }}>{fmt}</span>
                    <span style={{ fontSize: 12, color: 'var(--fg-2)', lineHeight: 1.5 }}>{desc}</span>
                  </div>
                ))}
              </div>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={async () => {
              try {
                const blob = await importApi.telechargerModele()
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a'); a.href = url; a.download = 'modele-rgnc.csv'; a.click()
                URL.revokeObjectURL(url)
              } catch { onToast(t('admin.import.modele_absent'), 'warning') }
            }}>
              <Icon name="download" size={13} />{t('admin.import.modele')}
            </button>
          </div>
        </div>
      )}

      {/* Étape 2 — fichier sélectionné */}
      {(step === 'idle' && file) && (
        <div>
          <div className="admin-card" style={{ marginBottom: 16 }}>
            <div className="admin-card-head">
              <Icon name="file-text" size={15} color="var(--fg-3)" />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-2)' }}>{file.name}</span>
              <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>· {(file.size / 1024).toFixed(1)} Ko</span>
            </div>
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--fg-2)', fontSize: 13 }}>
              {t('admin.import.pret')}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost btn-sm" onClick={reset}>{t('admin.import.annuler')}</button>
            <button className="btn btn-primary btn-sm" onClick={handleUpload}>
              <Icon name="check" size={13} />{t('admin.import.lancer')}
            </button>
          </div>
        </div>
      )}

      {/* Uploading */}
      {step === 'uploading' && (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <Icon name="loader" size={32} color="var(--rgnc-foret-700)" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 16px', display: 'block' }} />
          <div style={{ fontSize: 14, color: 'var(--fg-2)' }}>{t('admin.import.en_cours')}</div>
        </div>
      )}

      {/* Rapport */}
      {step === 'done' && result && (
        <div style={{ maxWidth: 520 }}>
          <div className="admin-card">
            <div className="admin-card-head"><h3>{t('admin.import.rapport')}</h3></div>
            <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { count: result.importees, lbl: t('admin.import.importees'),    col: 'var(--rgnc-success)', bg: 'var(--rgnc-success-bg)' },
                { count: result.doublons,  lbl: t('admin.import.doublons'),     col: '#92700A',             bg: 'var(--rgnc-warning-bg)' },
                { count: result.erreurs,   lbl: t('admin.import.lignes_erreur'),col: 'var(--rgnc-danger)',  bg: 'var(--rgnc-danger-bg)' },
              ].map(({ count, lbl, col, bg }) => (
                <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px', borderRadius: 'var(--radius-sm)', background: bg }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 700, color: col, lineHeight: 1, flexShrink: 0 }}>{count}</span>
                  <span style={{ fontSize: 14, color: col, fontWeight: 500 }}>{lbl}</span>
                </div>
              ))}
              {result.details?.length > 0 && (
                <details style={{ marginTop: 8 }}>
                  <summary style={{ cursor: 'pointer', fontSize: 12, color: 'var(--fg-3)' }}>{t('admin.import.detail')}</summary>
                  <table className="admin-table" style={{ marginTop: 8 }}>
                    <thead>
                      <tr>
                        <th>{t('admin.import.col.id')}</th>
                        <th>{t('admin.import.col.nom')}</th>
                        <th>{t('admin.import.col.statut')}</th>
                        <th>{t('admin.import.col.message')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.details.map((d, i) => (
                        <tr key={i} style={{ background: d.statut === 'erreur' ? 'var(--rgnc-danger-bg)' : d.statut === 'doublon' ? 'var(--rgnc-warning-bg)' : '' }}>
                          <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>{d.id}</td>
                          <td>{d.nom}</td>
                          <td><span className={`badge ${d.statut === 'ok' ? 'badge-success' : d.statut === 'doublon' ? 'badge-warning' : 'badge-danger'}`}><span className="badge-dot" />{d.statut}</span></td>
                          <td style={{ fontSize: 11, color: 'var(--fg-3)' }}>{d.message || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              )}
              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={reset}>
                  <Icon name="plus" size={13} />{t('admin.import.nouvel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Erreur */}
      {step === 'error' && (
        <div>
          <ApiError error={new Error(errMsg)} label={t('admin.import.erreur')} />
          <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={reset}>{t('admin.import.reessayer')}</button>
        </div>
      )}
    </div>
  )
}
