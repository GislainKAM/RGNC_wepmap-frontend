'use client'

import React, { useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { useLanguage } from '@/hooks/useLanguage'
import { useAdminUsers, useUpdateUser, useInviteAgent } from '@/hooks/useAdmin'
import type { ProfilUtilisateur } from '@/lib/types'
import { Spinner, ApiError } from './AdminUI'
import { inputSt } from './adminUtils'
import type { ToastType } from './adminUtils'

// ── InviteModal ───────────────────────────────────────────────────────────────

function InviteModal({ onClose, onToast }: { onClose: () => void; onToast: (m: string, t?: ToastType) => void }) {
  const { t } = useLanguage()
  const inviteMut = useInviteAgent()
  const [email, setEmail] = useState('')
  const [role,  setRole]  = useState('geometre')
  const [msg,   setMsg]   = useState('')

  const send = async () => {
    try {
      await inviteMut.mutateAsync({ email, role, message: msg })
      onToast(`${t('admin.toast.invite_envoye')} ${email}.`, 'success')
      onClose()
    } catch (e: any) {
      onToast(e?.response?.data?.detail || t('admin.agents.erreur'), 'danger')
    }
  }

  const fld: React.CSSProperties = { width: '100%', ...inputSt, height: 34, display: 'block' }
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(14,27,34,0.5)' }} />
      <div style={{ position: 'relative', width: 400, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: 'var(--fg-1)' }}>{t('admin.invite.titre')}</div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--fg-2)', display: 'block', marginBottom: 4 }}>{t('admin.invite.email')}</label>
          <input style={fld} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="agent@organisme.cm" type="email" />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--fg-2)', display: 'block', marginBottom: 4 }}>{t('admin.invite.role')}</label>
          <select style={fld} value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="geometre">{t('admin.invite.geometre')}</option>
            <option value="admin">{t('admin.invite.administrateur')}</option>
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 500, color: 'var(--fg-2)', display: 'block', marginBottom: 4 }}>{t('admin.invite.message_opt')}</label>
          <textarea style={{ ...fld, height: 64, resize: 'vertical' }} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Message personnalisé dans l'email d'invitation…" />
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ flex: 1 }}>{t('admin.invite.annuler')}</button>
          <button className="btn btn-primary btn-sm" style={{ flex: 2 }} onClick={send} disabled={!email || inviteMut.isPending}>
            {inviteMut.isPending ? t('admin.invite.envoi') : t('admin.invite.envoyer')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── SectionAgents ─────────────────────────────────────────────────────────────

export function SectionAgents({ onToast }: { onToast: (m: string, t?: ToastType) => void }) {
  const { t } = useLanguage()
  const { data, isLoading, error } = useAdminUsers({ role: 'geometre' })
  const updateMut = useUpdateUser()
  const [showInvite, setShowInvite] = useState(false)

  const users: ProfilUtilisateur[] = data?.results ?? []

  const toggleVerif = async (u: ProfilUtilisateur) => {
    try {
      await updateMut.mutateAsync({ id: u.id, data: { est_verifie: !u.est_verifie } })
      onToast(`${u.nom_complet} — ${t('admin.toast.statut_maj')}.`, 'success')
    } catch (e: any) {
      onToast(e?.response?.data?.detail || t('admin.agents.erreur'), 'danger')
    }
  }

  if (isLoading) return <Spinner />
  if (error)     return <ApiError error={error} label={t('admin.agents.erreur')} />

  return (
    <>
      <div className="admin-card">
        <div className="admin-card-head">
          <h3>{t('admin.title.agents')}</h3>
          <span style={{ fontSize: 12, color: 'var(--fg-3)', marginLeft: 8 }}>{data?.count ?? 0} {t('admin.agents.agents')}</span>
          <button className="btn btn-primary btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setShowInvite(true)}>
            <Icon name="plus" size={13} />{t('admin.agents.inviter')}
          </button>
        </div>
        {users.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--fg-3)', fontSize: 13 }}>{t('admin.agents.aucun')}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-table" style={{ minWidth: 600 }}>
              <thead>
                <tr>
                  {[
                    t('admin.agents.col.nom'), t('admin.agents.col.email'),
                    t('admin.agents.col.org'), t('admin.agents.col.region'),
                    t('admin.agents.col.statut'), t('admin.agents.col.inscription'), '',
                  ].map((h) => <th key={h}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 500 }}>{u.nom_complet}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11.5, color: 'var(--fg-2)' }}>{u.email}</td>
                    <td style={{ color: 'var(--fg-2)', fontSize: 12 }}>{u.organisation}</td>
                    <td style={{ color: 'var(--fg-2)', fontSize: 12 }}>{u.region_nom}</td>
                    <td>
                      {u.est_verifie
                        ? <span className="badge badge-success"><span className="badge-dot" />{t('admin.agents.verifie')}</span>
                        : <span className="badge badge-warning"><span className="badge-dot" />{t('admin.agents.en_attente')}</span>}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-3)' }}>
                      {new Date(u.date_inscription).toLocaleDateString()}
                    </td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => toggleVerif(u)}
                        disabled={updateMut.isPending}
                        title={u.est_verifie ? t('admin.requests.rejeter') : t('admin.agents.verifie')}
                      >
                        <Icon name={u.est_verifie ? 'x' : 'check'} size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {showInvite && <InviteModal onClose={() => setShowInvite(false)} onToast={onToast} />}
    </>
  )
}
