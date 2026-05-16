'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { OrdreIcon } from '@/components/ui/OrdreIcon'
import { useLanguage } from '@/hooks/useLanguage'
import {
  useAdminBornes, useAdminBorneDetail,
  useCreateBorne, useUpdateBorne, useDeleteBornes,
} from '@/hooks/useAdmin'
import { regionApi, departementApi, communeApi, pointApi } from '@/lib/api'
import { useQuery } from '@tanstack/react-query'
import { STATUT_COLORS as STATUT_COLORS_CONST, RESEAU_LABELS as RESEAU_LABELS_CONST } from '@/lib/constants'
import type {
  PointGeodesiqueLight, PointGeodesiqueDetail,
  StatutBorne, OrdreBorne, ReseauBorne,
} from '@/lib/types'
import { Spinner, ApiError } from './AdminUI'
import { STATUT_CLS, inputSt } from './adminUtils'
import type { ToastType } from './adminUtils'

const STATUT_COLORS = STATUT_COLORS_CONST as Record<StatutBorne, string>
const RESEAU_LABELS = RESEAU_LABELS_CONST as Record<ReseauBorne, string>

// ── BorneSlideOver ────────────────────────────────────────────────────────────

interface BorneFormData {
  nom: string; matricule: string
  latitude_dd: string; longitude_dd: string; altitude_ngac: string; zone_utm: string
  ordre: OrdreBorne; reseau: ReseauBorne; statut: StatutBorne
  region: string; departement: string; commune: string; localite: string
  description_acces: string; description_borne: string
}

function BorneSlideOver({ editId, onClose, onToast }: {
  editId: number | null
  onClose: () => void
  onToast: (m: string, t?: ToastType) => void
}) {
  const { t } = useLanguage()
  const isNew = editId === null
  const { data: detail, isLoading: detailLoading } = useAdminBorneDetail(editId)
  const createMut  = useCreateBorne()
  const updateMut  = useUpdateBorne()
  const isSaving   = createMut.isPending || updateMut.isPending

  const { data: regions = [] } = useQuery({ queryKey: ['regions'], queryFn: regionApi.list, staleTime: Infinity })
  const [regionId, setRegionId] = useState<number | ''>('')
  const [deptId,   setDeptId]   = useState<number | ''>('')
  const { data: depts = [] } = useQuery({
    queryKey: ['depts', regionId], queryFn: () => departementApi.list(regionId as number),
    enabled: regionId !== '', staleTime: Infinity,
  })
  const { data: communes = [] } = useQuery({
    queryKey: ['communes', deptId], queryFn: () => communeApi.list(deptId as number),
    enabled: deptId !== '', staleTime: Infinity,
  })

  const [form, setForm] = useState<BorneFormData>({
    nom: '', matricule: '', latitude_dd: '', longitude_dd: '', altitude_ngac: '',
    zone_utm: '33N', ordre: 2, reseau: 'PAMOCCA', statut: 'actif',
    region: '', departement: '', commune: '', localite: '',
    description_acces: '', description_borne: '',
  })

  // ── Photo terrain ─────────────────────────────────────────────
  const photoInputRef                     = useRef<HTMLInputElement>(null)
  const [photoFile,     setPhotoFile]     = useState<File | null>(null)        // nouveau fichier sélectionné
  const [photoPreview,  setPhotoPreview]  = useState<string | null>(null)      // blob URL prévisualisation
  const [deletePhoto,   setDeletePhoto]   = useState(false)                    // marquer photo à supprimer
  const MAX_PHOTO  = 5 * 1024 * 1024
  const PHOTO_MIME = ['image/jpeg', 'image/png', 'image/webp']

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!PHOTO_MIME.includes(file.type)) { alert('Format non supporté (JPG, PNG ou WebP)'); return }
    if (file.size > MAX_PHOTO) { alert('Fichier trop volumineux (max 5 Mo)'); return }
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
    setDeletePhoto(false)
    if (photoInputRef.current) photoInputRef.current.value = ''
  }

  const handleRemovePhoto = () => {
    setPhotoFile(null)
    setPhotoPreview(null)
    setDeletePhoto(true)
  }

  useEffect(() => {
    if (detail) {
      setForm({
        nom:               detail.nom,
        matricule:         detail.matricule,
        latitude_dd:       String(detail.latitude_dd),
        longitude_dd:      String(detail.longitude_dd),
        altitude_ngac:     detail.altitude_ngac != null ? String(detail.altitude_ngac) : '',
        zone_utm:          detail.zone_utm || '33N',
        ordre:             detail.ordre,
        reseau:            detail.reseau,
        statut:            detail.statut,
        region:            detail.region_nom      ?? '',
        departement:       detail.departement_nom ?? '',
        commune:           detail.commune_nom     ?? '',
        localite:          detail.localite,
        description_acces: detail.description_acces,
        description_borne: detail.description_borne,
      })
    }
  }, [detail])

  const set = <K extends keyof BorneFormData>(k: K, v: BorneFormData[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const handleSave = async () => {
    const payload: Partial<PointGeodesiqueDetail> = {
      nom:               form.nom,
      matricule:         form.matricule || undefined,
      latitude_dd:       parseFloat(form.latitude_dd),
      longitude_dd:      parseFloat(form.longitude_dd),
      altitude_ngac:     form.altitude_ngac ? parseFloat(form.altitude_ngac) : null,
      zone_utm:          form.zone_utm,
      ordre:             form.ordre,
      reseau:            form.reseau,
      statut:            form.statut,
      localite:          form.localite,
      description_acces: form.description_acces,
      description_borne: form.description_borne,
    }
    if (regionId !== '')  (payload as any).region      = regionId
    if (deptId   !== '')  (payload as any).departement = deptId
    if (communes.length && form.commune) {
      const c = communes.find((x) => x.nom === form.commune)
      if (c) (payload as any).commune = c.id
    }
    try {
      let savedId = editId
      if (isNew) {
        const created = await createMut.mutateAsync(payload)
        savedId = (created as any).id ?? savedId
        onToast(`"${form.nom}" ${t('admin.toast.borne_creee')}.`, 'success')
      } else {
        await updateMut.mutateAsync({ id: editId!, data: payload })
        onToast(`"${form.nom}" — ${t('admin.toast.borne_modifiee')}.`, 'success')
      }

      // ── Photo : upload ou suppression après la sauvegarde principale ──
      if (savedId) {
        if (photoFile) {
          await pointApi.uploadPhoto(savedId, photoFile)
        } else if (deletePhoto) {
          await pointApi.deletePhoto(savedId)
        }
      }

      onClose()
    } catch (e: any) {
      onToast(e?.response?.data?.detail || t('admin.borne.err_save'), 'danger')
    }
  }

  const fld: React.CSSProperties = {
    width: '100%', fontFamily: 'var(--font-body)', fontSize: 13, padding: '8px 10px',
    background: 'var(--bg-sunken)', border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-sm)', color: 'var(--fg-1)', outline: 'none',
    height: 34, boxSizing: 'border-box',
  }
  const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--fg-2)', marginBottom: 4 }
  const sec: React.CSSProperties = { fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--fg-3)', margin: '14px 0 10px', borderTop: '1px solid var(--border-subtle)', paddingTop: 10 }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 800, display: 'flex' }}>
      <div onClick={onClose} style={{ flex: 1, background: 'rgba(14,27,34,0.45)' }} />
      <div className="admin-slideover" style={{ background: 'var(--bg-elevated)', display: 'flex', flexDirection: 'column', height: '100%', boxShadow: 'var(--shadow-lg)', width: 'min(440px, 100vw)' }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: 'var(--fg-1)' }}>
              {isNew ? t('admin.borne.nouvelle') : detailLoading ? t('admin.borne.saving') : `${t('admin.borne.modifier')} ${detail?.matricule}`}
            </div>
            {!isNew && detail && <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>{detail.matricule}</div>}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: 'var(--fg-3)', display: 'flex' }}>
            <Icon name="x" size={16} />
          </button>
        </div>

        {detailLoading && !isNew
          ? <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Spinner /></div>
          : (
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 18px 16px' }}>
            <div style={sec}>{t('admin.borne.s.designation')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label style={lbl}>{t('admin.borne.lbl.nom')}</label>
                <input style={fld} value={form.nom} onChange={(e) => set('nom', e.target.value)} placeholder="ex : Repère Etoa-Meki" />
              </div>
              <div>
                <label style={lbl}>{t('admin.borne.lbl.matricule')}</label>
                <input style={fld} value={form.matricule} onChange={(e) => set('matricule', e.target.value)} placeholder="ex : B441" />
              </div>
            </div>

            <div style={sec}>{t('admin.borne.s.localisation')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label style={lbl}>{t('admin.borne.lbl.region')}</label>
                <select style={{ ...fld }} value={regionId} onChange={(e) => { const v = Number(e.target.value); setRegionId(v || ''); setDeptId('') }}>
                  <option value="">{t('admin.borne.choisir')}</option>
                  {regions.map((r) => <option key={r.id} value={r.id}>{r.nom}</option>)}
                </select>
                {detail?.region_nom && regionId === '' && <span style={{ fontSize: 10, color: 'var(--fg-3)' }}>{t('admin.borne.actuel')} {detail.region_nom}</span>}
              </div>
              <div>
                <label style={lbl}>{t('admin.borne.lbl.dept')}</label>
                <select style={{ ...fld }} value={deptId} onChange={(e) => { const v = Number(e.target.value); setDeptId(v || ''); set('departement', e.target.options[e.target.selectedIndex].text) }} disabled={regionId === ''}>
                  <option value="">{t('admin.borne.choisir')}</option>
                  {depts.map((d) => <option key={d.id} value={d.id}>{d.nom}</option>)}
                </select>
                {detail?.departement_nom && deptId === '' && <span style={{ fontSize: 10, color: 'var(--fg-3)' }}>{t('admin.borne.actuel')} {detail.departement_nom}</span>}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label style={lbl}>{t('admin.borne.lbl.commune')}</label>
                <select style={{ ...fld }} value={form.commune} onChange={(e) => set('commune', e.target.value)} disabled={deptId === ''}>
                  <option value="">{t('admin.borne.choisir')}</option>
                  {communes.map((c) => <option key={c.id} value={c.nom}>{c.nom}</option>)}
                </select>
                {detail?.commune_nom && form.commune === '' && <span style={{ fontSize: 10, color: 'var(--fg-3)' }}>{t('admin.borne.actuel')} {detail.commune_nom}</span>}
              </div>
              <div>
                <label style={lbl}>{t('admin.borne.lbl.localite')}</label>
                <input style={fld} value={form.localite} onChange={(e) => set('localite', e.target.value)} placeholder="ex : Etoa-Meki" />
              </div>
            </div>

            <div style={sec}>{t('admin.borne.s.coords')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label style={lbl}>{t('admin.borne.lbl.lat')}</label>
                <input style={fld} value={form.latitude_dd} onChange={(e) => set('latitude_dd', e.target.value)} placeholder="ex : 3.86306" />
              </div>
              <div>
                <label style={lbl}>{t('admin.borne.lbl.lon')}</label>
                <input style={fld} value={form.longitude_dd} onChange={(e) => set('longitude_dd', e.target.value)} placeholder="ex : 11.52000" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              <div>
                <label style={lbl}>{t('admin.borne.lbl.alt')}</label>
                <input style={fld} value={form.altitude_ngac} onChange={(e) => set('altitude_ngac', e.target.value)} placeholder="ex : 758.421" />
              </div>
              <div>
                <label style={lbl}>{t('admin.borne.lbl.utm')}</label>
                <select style={{ ...fld }} value={form.zone_utm} onChange={(e) => set('zone_utm', e.target.value)}>
                  <option value="32N">32N</option>
                  <option value="33N">33N</option>
                </select>
              </div>
            </div>

            <div style={sec}>{t('admin.borne.s.caract')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
              <div>
                <label style={lbl}>{t('admin.borne.lbl.ordre')}</label>
                <select style={{ ...fld }} value={form.ordre} onChange={(e) => set('ordre', Number(e.target.value) as OrdreBorne)}>
                  <option value={1}>{t('admin.borne.ordre.1')}</option>
                  <option value={2}>{t('admin.borne.ordre.2')}</option>
                  <option value={3}>{t('admin.borne.ordre.3')}</option>
                </select>
              </div>
              <div>
                <label style={lbl}>{t('admin.borne.lbl.reseau')}</label>
                <select style={{ ...fld }} value={form.reseau} onChange={(e) => set('reseau', e.target.value as ReseauBorne)}>
                  {(Object.entries(RESEAU_LABELS) as [ReseauBorne, string][]).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label style={lbl}>{t('admin.borne.lbl.statut')}</label>
              <select style={{ ...fld }} value={form.statut} onChange={(e) => set('statut', e.target.value as StatutBorne)}>
                <option value="actif">{t('admin.statut.actif')}</option>
                <option value="degrade">{t('admin.statut.degrade')}</option>
                <option value="detruit">{t('admin.statut.detruit')}</option>
                <option value="inconnu">{t('admin.statut.inconnu')}</option>
              </select>
            </div>

            <div style={sec}>{t('admin.borne.s.description')}</div>
            <div style={{ marginBottom: 10 }}>
              <label style={lbl}>{t('admin.borne.lbl.acces')}</label>
              <textarea style={{ ...fld, height: 64, resize: 'vertical', lineHeight: 1.5 }} value={form.description_acces} onChange={(e) => set('description_acces', e.target.value)} placeholder="Instructions pour atteindre la borne…" />
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={lbl}>{t('admin.borne.lbl.description')}</label>
              <textarea style={{ ...fld, height: 64, resize: 'vertical', lineHeight: 1.5 }} value={form.description_borne} onChange={(e) => set('description_borne', e.target.value)} placeholder="État, matériau, marquage…" />
            </div>

            {/* ── Photo terrain ── */}
            <div style={sec}>Photo terrain</div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: 'none' }}
              onChange={handlePhotoSelect}
            />

            {/* Prévisualisation : nouveau fichier > photo existante > zone vide */}
            {(photoPreview || (detail?.photo_url && !deletePhoto)) ? (
              <div style={{ position: 'relative', marginBottom: 10 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoPreview ?? detail?.photo_url ?? ''}
                  alt="Photo terrain"
                  style={{
                    width: '100%', aspectRatio: '3/2', objectFit: 'cover',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                    display: 'block',
                  }}
                />
                {/* Badge "Nouveau" si fichier local sélectionné */}
                {photoPreview && (
                  <span style={{
                    position: 'absolute', top: 6, left: 6,
                    background: 'var(--rgnc-foret-700)', color: '#fff',
                    fontSize: 10, fontWeight: 700, padding: '2px 7px',
                    borderRadius: 'var(--radius-pill)',
                  }}>Nouveau</span>
                )}
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button type="button" onClick={() => photoInputRef.current?.click()} style={{
                    flex: 1, padding: '6px 10px',
                    border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-app)', color: 'var(--fg-2)',
                    fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}>
                    <Icon name="camera" size={12} /> Changer
                  </button>
                  <button type="button" onClick={handleRemovePhoto} style={{
                    padding: '6px 10px',
                    border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)',
                    background: 'none', color: 'var(--rgnc-danger)',
                    fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}>
                    <Icon name="trash-2" size={12} /> Supprimer
                  </button>
                </div>
              </div>
            ) : (
              /* Zone de dépôt / sélection */
              <div
                onClick={() => photoInputRef.current?.click()}
                style={{
                  border: '2px dashed var(--border-strong)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '24px 16px',
                  textAlign: 'center', cursor: 'pointer',
                  color: 'var(--fg-3)', fontSize: 12,
                  marginBottom: 10,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-sunken)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = '')}
              >
                <Icon name="camera" size={22} style={{ display: 'block', margin: '0 auto 8px', color: 'var(--fg-4)' }} />
                <div style={{ fontWeight: 500, color: 'var(--fg-2)', marginBottom: 3 }}>
                  Ajouter une photo terrain
                </div>
                <div>JPG, PNG ou WebP — max 5 Mo</div>
              </div>
            )}

            {(createMut.error || updateMut.error) && (
              <div style={{ marginTop: 12 }}>
                <ApiError error={createMut.error || updateMut.error} label={t('admin.borne.err_save')} />
              </div>
            )}
          </div>
        )}

        <div style={{ padding: '11px 18px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 8, flexShrink: 0 }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ flex: 1 }} disabled={isSaving}>{t('admin.borne.annuler')}</button>
          <button className="btn btn-primary btn-sm" style={{ flex: 2 }} onClick={handleSave} disabled={isSaving || !form.nom || !form.latitude_dd || !form.longitude_dd}>
            {isSaving ? t('admin.borne.saving') : isNew ? t('admin.borne.creer') : t('admin.borne.enregistrer')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── SectionBornes ─────────────────────────────────────────────────────────────

export function SectionBornes({ onToast }: { onToast: (m: string, t?: ToastType) => void }) {
  const { t } = useLanguage()
  const [search,    setSearch]    = useState('')
  const [filterSt,  setFilterSt]  = useState<StatutBorne | ''>('')
  const [filterOrd, setFilterOrd] = useState<OrdreBorne | ''>('')
  const [page,      setPage]      = useState(1)
  const [selIds,    setSelIds]    = useState<Set<number>>(new Set())
  const [editId,    setEditId]    = useState<number | null | 'new'>(null)

  const filtres = {
    ...(search    ? { recherche: search }  : {}),
    ...(filterSt  ? { statuts: [filterSt] } : {}),
    ...(filterOrd ? { ordres: [filterOrd] } : {}),
  }
  const { data, isLoading, error } = useAdminBornes(filtres, page)
  const deleteMut = useDeleteBornes()

  const bornes = data?.results ?? []
  const total  = data?.count   ?? 0
  const totalPages = Math.ceil(total / 25) || 1

  const toggleSel = (id: number) => setSelIds((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const toggleAll = () => setSelIds(selIds.size === bornes.length && bornes.length > 0 ? new Set() : new Set(bornes.map((b) => b.id)))

  const handleDelete = async () => {
    if (!confirm(`${t('admin.toast.confirm_supp')} ${selIds.size} ${t('admin.toast.bornes_sel')}`)) return
    try {
      await deleteMut.mutateAsync([...selIds])
      onToast(`${selIds.size} ${t('admin.toast.bornes_supp')}.`, 'success')
      setSelIds(new Set())
    } catch {
      onToast(t('admin.bornes.erreur'), 'danger')
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '0 0 240px' }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}>
            <Icon name="search" size={14} color="var(--fg-3)" />
          </span>
          <input style={{ ...inputSt, width: '100%', paddingLeft: 32 }}
            placeholder={t('admin.bornes.search')} value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }} />
        </div>
        <select style={inputSt} value={filterOrd} onChange={(e) => { setFilterOrd(Number(e.target.value) as OrdreBorne || ''); setPage(1) }}>
          <option value="">{t('admin.bornes.tous_ordres')}</option>
          <option value={1}>{t('admin.ordre.1')}</option>
          <option value={2}>{t('admin.ordre.2')}</option>
          <option value={3}>{t('admin.ordre.3')}</option>
        </select>
        <select style={inputSt} value={filterSt} onChange={(e) => { setFilterSt(e.target.value as StatutBorne || ''); setPage(1) }}>
          <option value="">{t('admin.bornes.tous_statuts')}</option>
          <option value="actif">{t('admin.statut.actif')}</option>
          <option value="degrade">{t('admin.statut.degrade')}</option>
          <option value="detruit">{t('admin.statut.detruit')}</option>
          <option value="inconnu">{t('admin.statut.inconnu')}</option>
        </select>
        <span style={{ fontSize: 13, color: 'var(--fg-3)', marginLeft: 4 }}>
          <b style={{ color: 'var(--fg-1)' }}>{isLoading ? '…' : total.toLocaleString()}</b> {t('admin.bornes.bornes')}
        </span>
        <div style={{ flex: 1 }} />
        {selIds.size > 0 && (
          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--rgnc-danger)' }} onClick={handleDelete} disabled={deleteMut.isPending}>
            <Icon name="x" size={13} />{deleteMut.isPending ? t('admin.bornes.suppression') : `${t('admin.bornes.supprimer')} (${selIds.size})`}
          </button>
        )}
        <button className="btn btn-primary btn-sm" onClick={() => setEditId('new')}>
          <Icon name="plus" size={13} />{t('admin.bornes.ajouter')}
        </button>
      </div>

      {error && <div style={{ marginBottom: 12 }}><ApiError error={error} label={t('admin.bornes.erreur')} /></div>}

      <div className="admin-card">
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table className="admin-table" style={{ minWidth: 700 }}>
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input type="checkbox" style={{ accentColor: 'var(--rgnc-foret-700)' }}
                    onChange={toggleAll} checked={selIds.size === bornes.length && bornes.length > 0} />
                </th>
                {[
                  t('admin.bornes.col.matricule'), t('admin.bornes.col.nom'),
                  t('admin.bornes.col.region'), t('admin.bornes.col.commune'),
                  t('admin.bornes.col.localite'), t('admin.bornes.col.ordre'),
                  t('admin.bornes.col.statut'),
                ].map((h) => <th key={h}>{h}</th>)}
                {/* Colonne action — sticky à droite */}
                <th className="admin-col-sticky-right" style={{ width: 44 }}></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={9}><Spinner /></td></tr>}
              {!isLoading && bornes.map((b: PointGeodesiqueLight) => (
                <tr key={b.id} onClick={() => toggleSel(b.id)} style={{ background: selIds.has(b.id) ? 'var(--rgnc-foret-50)' : '', cursor: 'pointer' }}>
                  <td onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selIds.has(b.id)} readOnly style={{ accentColor: 'var(--rgnc-foret-700)' }} />
                  </td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-3)' }}>{b.matricule}</td>
                  <td style={{ fontWeight: 500, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.nom}</td>
                  <td style={{ color: 'var(--fg-2)' }}>{b.region_nom}</td>
                  <td style={{ color: 'var(--fg-2)' }}>{b.commune_nom}</td>
                  <td style={{ color: 'var(--fg-3)', fontStyle: 'italic', fontSize: 12 }}>{b.localite}</td>
                  <td>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      {/* Forme = ordre, couleur = statut — cohérent avec la carte */}
                      <OrdreIcon ordre={b.ordre} size={14} color={STATUT_COLORS[b.statut] ?? '#9BA5AC'} />
                      <span style={{ fontSize: 11, color: 'var(--fg-2)' }}>
                        {t(`admin.ordre.${b.ordre}` as any)}
                      </span>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${STATUT_CLS[b.statut] ?? ''}`}>
                      <span className="badge-dot" />{t(`admin.statut.${b.statut}` as any)}
                    </span>
                  </td>
                  <td className="admin-col-sticky-right" onClick={(e) => e.stopPropagation()}>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '4px 8px' }}
                      onClick={() => setEditId(b.id)}
                      title={t('admin.borne.modifier')}
                    >
                      <Icon name="pencil" size={13} />
                    </button>
                  </td>
                </tr>
              ))}
              {!isLoading && bornes.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: 'center', padding: '24px', color: 'var(--fg-3)' }}>{t('admin.bornes.aucune')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>
            {t('admin.bornes.page_sur')} {page} / {totalPages} · {total.toLocaleString()} {t('admin.bornes.bornes')}
          </span>
          <div style={{ display: 'flex', gap: 5 }}>
            <button onClick={() => setPage(1)} disabled={page === 1} style={{ ...inputSt, width: 32, cursor: 'pointer', height: 28, padding: '0 6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>«</button>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} style={{ ...inputSt, width: 32, cursor: 'pointer', height: 28, padding: '0 6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
            <span style={{ ...inputSt, width: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--rgnc-foret-700)', color: '#fff', height: 28 }}>{page}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ ...inputSt, width: 32, cursor: 'pointer', height: 28, padding: '0 6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
            <button onClick={() => setPage(totalPages)} disabled={page === totalPages} style={{ ...inputSt, width: 32, cursor: 'pointer', height: 28, padding: '0 6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>»</button>
          </div>
        </div>
      </div>

      {editId !== null && (
        <BorneSlideOver
          editId={editId === 'new' ? null : editId}
          onClose={() => setEditId(null)}
          onToast={onToast}
        />
      )}
    </div>
  )
}
