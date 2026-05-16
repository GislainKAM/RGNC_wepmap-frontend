'use client'

import React, { useRef, useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/ui/Icon'
import { useAuth } from '@/hooks/useAuth'
import { useLanguage } from '@/hooks/useLanguage'
import { ROUTES } from '@/lib/constants'

type View = 'map' | 'list'

interface HeaderProps {
  view:             View
  onViewChange:     (v: View) => void
  onSearch:         (q: string) => void
  onToggleFilters:  () => void
  filtersCollapsed: boolean
}

// ── Panel Notifications ───────────────────────────────────────────────────────

// Structure d'une notification (à brancher sur /api/notifications/ plus tard)
interface Notif {
  id:   number
  msg:  string
  date: string
  read: boolean
  type: 'info' | 'success' | 'warning'
}

const NOTIF_COLORS: Record<Notif['type'], string> = {
  info:    'var(--rgnc-info)',
  success: 'var(--rgnc-success)',
  warning: 'var(--rgnc-warning)',
}

function NotifPanel({ onClose, t }: { onClose: () => void; t: (k: any) => string }) {
  // Exemple : liste vide = état initial, à remplacer par useQuery('/notifications/')
  const [notifs, setNotifs] = useState<Notif[]>([])

  const markAll = () => setNotifs((ns) => ns.map((n) => ({ ...n, read: true })))

  return (
    <div
      style={{
        position: 'absolute', top: 'calc(100% + 8px)', right: 0,
        width: 320, background: 'var(--bg-elevated)',
        border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-lg)', zIndex: 500, overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, color: 'var(--fg-1)', flex: 1 }}>
          {t('header.notifications')}
        </span>
        {notifs.some((n) => !n.read) && (
          <button
            onClick={markAll}
            style={{ fontSize: 11, color: 'var(--rgnc-foret-700)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            {t('header.notif.mark_all')}
          </button>
        )}
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'var(--fg-3)', display: 'flex' }}>
          <Icon name="x" size={14} />
        </button>
      </div>

      {/* Contenu */}
      {notifs.length === 0 ? (
        <div style={{ padding: '32px 16px', textAlign: 'center' }}>
          <Icon name="bell" size={24} color="var(--fg-4)" style={{ margin: '0 auto 10px', display: 'block' }} />
          <p style={{ fontSize: 13, color: 'var(--fg-3)', margin: 0 }}>{t('header.notif.empty')}</p>
        </div>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 320, overflowY: 'auto' }}>
          {notifs.map((n) => (
            <li
              key={n.id}
              onClick={() => setNotifs((ns) => ns.map((x) => x.id === n.id ? { ...x, read: true } : x))}
              style={{
                display: 'flex', gap: 10, padding: '10px 16px',
                borderBottom: '1px solid var(--border-subtle)',
                background: n.read ? 'transparent' : 'var(--bg-surface)',
                cursor: 'pointer',
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: n.read ? 'transparent' : NOTIF_COLORS[n.type], flexShrink: 0, marginTop: 5 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 12.5, color: 'var(--fg-1)', lineHeight: 1.4 }}>{n.msg}</p>
                <span style={{ fontSize: 11, color: 'var(--fg-4)' }}>{n.date}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Modal Préférences ─────────────────────────────────────────────────────────

function PrefModal({ onClose, t, lang, setLang }: {
  onClose: () => void
  t:       (k: any) => string
  lang:    'fr' | 'en'
  setLang: (l: 'fr' | 'en') => void
}) {
  // ── Lecture des prefs stockées — via useEffect pour éviter l'erreur SSR ──
  const [zoom,       setZoom]       = useState(6)
  const [emailNotif, setEmailNotif] = useState(false)
  const [saved,      setSaved]      = useState(false)

  useEffect(() => {
    setZoom(Number(localStorage.getItem('rgnc-pref-zoom') ?? 6))
    setEmailNotif(localStorage.getItem('rgnc-pref-emailnotif') === 'true')
  }, [])

  const save = () => {
    localStorage.setItem('rgnc-pref-zoom',       String(zoom))
    localStorage.setItem('rgnc-pref-emailnotif', String(emailNotif))
    // Émettre un événement custom pour que MapCanvas puisse réagir sans re-mount
    window.dispatchEvent(new CustomEvent('rgnc-pref-changed', { detail: { zoom } }))
    setSaved(true)
    setTimeout(() => { setSaved(false); onClose() }, 900)
  }

  const btnBase: React.CSSProperties = {
    height: 32, borderRadius: 'var(--radius-sm)', cursor: 'pointer',
    fontFamily: 'var(--font-body)', fontSize: 13, border: '1px solid var(--border-subtle)',
  }
  const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 500, color: 'var(--fg-2)', display: 'block', marginBottom: 6 }
  const row: React.CSSProperties = { marginBottom: 18 }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(14,27,34,0.45)' }} />

      {/* Panneau */}
      <div style={{
        position: 'relative', width: 'min(380px, calc(100vw - 32px))',
        background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-lg)', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center' }}>
          <Icon name="settings" size={16} color="var(--fg-3)" style={{ marginRight: 8 }} />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 600, color: 'var(--fg-1)', flex: 1 }}>
            {t('header.pref.title')}
          </span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--fg-3)', display: 'flex' }}>
            <Icon name="x" size={16} />
          </button>
        </div>

        {/* Corps */}
        <div style={{ padding: '18px 20px' }}>

          {/* Langue */}
          <div style={row}>
            <label style={lbl}>{t('header.pref.langue')}</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['fr', 'en'] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLang(l)}
                  style={{
                    padding: '6px 20px', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                    fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600,
                    border: `1px solid ${lang === l ? 'var(--rgnc-foret-700)' : 'var(--border-subtle)'}`,
                    background: lang === l ? 'var(--rgnc-foret-700)' : 'var(--bg-sunken)',
                    color: lang === l ? '#fff' : 'var(--fg-2)',
                    transition: 'all 150ms',
                  }}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Zoom initial */}
          <div style={row}>
            <label style={lbl}>
              {t('header.pref.zoom_carte')} —{' '}
              <b style={{ color: 'var(--rgnc-foret-700)' }}>{zoom}</b>
            </label>
            <input
              type="range" min={5} max={14} step={1} value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--rgnc-foret-700)', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--fg-4)', marginTop: 2 }}>
              <span>5 — {lang === 'fr' ? 'National' : 'National'}</span>
              <span>14 — {lang === 'fr' ? 'Local' : 'Local'}</span>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--fg-4)' }}>
              {t('header.pref.zoom_aide')}
            </p>
          </div>

          {/* Notifications email */}
          <div style={{ ...row, marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--fg-1)' }}>{t('header.pref.notif')}</div>
                <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2 }}>{t('header.pref.notif.sub')}</div>
              </div>
              {/* Toggle switch */}
              <button
                onClick={() => setEmailNotif((v) => !v)}
                aria-checked={emailNotif}
                role="switch"
                style={{
                  width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
                  background: emailNotif ? 'var(--rgnc-foret-700)' : 'var(--border-strong)',
                  position: 'relative', transition: 'background 200ms', flexShrink: 0,
                }}
              >
                <span style={{
                  position: 'absolute', top: 3, left: emailNotif ? 21 : 3,
                  width: 16, height: 16, borderRadius: '50%', background: '#fff',
                  transition: 'left 200ms', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }} />
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button
            onClick={onClose}
            style={{ ...btnBase, padding: '0 16px', background: 'transparent', color: 'var(--fg-2)' }}
          >
            {t('header.pref.cancel')}
          </button>
          <button
            onClick={save}
            style={{
              ...btnBase, padding: '0 20px',
              background: saved ? 'var(--rgnc-success)' : 'var(--rgnc-foret-700)',
              color: '#fff', border: 'none', fontWeight: 600,
              transition: 'background 200ms',
            }}
          >
            {saved ? t('header.pref.saved') : t('header.pref.save')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Composant Header principal ────────────────────────────────────────────────

export function Header({
  view,
  onViewChange,
  onSearch,
  onToggleFilters,
  filtersCollapsed,
}: HeaderProps) {
  const router             = useRouter()
  const user               = useAuth((s) => s.user)
  const isAuth             = useAuth((s) => s.isAuthenticated)
  const logout             = useAuth((s) => s.logout)
  const { lang, setLang, t } = useLanguage()

  const [searchVal,  setSearchVal]  = useState('')
  const [dropOpen,   setDropOpen]   = useState(false)
  const [notifOpen,  setNotifOpen]  = useState(false)
  const [prefOpen,   setPrefOpen]   = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dropRef     = useRef<HTMLDivElement>(null)
  const notifRef    = useRef<HTMLDivElement>(null)

  const handleSearch = useCallback(
    (val: string) => {
      setSearchVal(val)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => onSearch(val), 300)
    },
    [onSearch]
  )

  // Fermer les dropdowns au clic extérieur
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropRef.current  && !dropRef.current.contains(e.target  as Node)) setDropOpen(false)
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLogout = () => {
    setDropOpen(false)
    logout()
    router.push(ROUTES.LOGIN)
  }

  const initials   = user
    ? (user.nom_complet || user.username).split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : '?'
  const userName   = user?.nom_complet || user?.username  || 'Agent MINDCAF'
  const userRole   = user?.role_label  || 'Visiteur'
  const userExtra  = user?.region_nom  ? `· ${user.region_nom}` : ''
  const userPhoto  = (user as any)?.photo_url as string | null | undefined

  return (
    <>
      <header className="hdr">

        {/* ── Logo ── */}
        <Link href={ROUTES.MAP} className="hdr-brand" style={{ textDecoration: 'none' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/logo/rgnc-webmap-wordmark.svg" alt="RGNC WebMap" style={{ height: 28, width: 'auto' }} />
        </Link>

        <div className="hdr-divider" />

        {/* ── Breadcrumb ── */}
        <div className="hdr-breadcrumb">
          <span>{t('header.breadcrumb.pays')}</span>
          {user?.region_nom && (
            <>
              <span className="sep">›</span>
              <span>{user.region_nom}</span>
            </>
          )}
        </div>

        {/* ── Recherche ── */}
        <div className="hdr-search-wrap">
          <span className="hdr-search-ico"><Icon name="search" size={15} /></span>
          <input
            className="hdr-search"
            placeholder={t('header.search')}
            value={searchVal}
            onChange={(e) => handleSearch(e.target.value)}
          />
          <span className="hdr-search-kbd">⌘ K</span>
        </div>

        <div className="hdr-right">

          {/* Toggle filtres */}
          <button
            className="hdr-icon-btn"
            title={filtersCollapsed ? t('header.filtres.show') : t('header.filtres.hide')}
            onClick={onToggleFilters}
          >
            <Icon name={filtersCollapsed ? 'panel-left-open' : 'panel-left-close'} size={18} />
          </button>

          {/* Vue Carte / Liste */}
          <div className="view-switch">
            <button className={`view-switch-btn${view === 'map'  ? ' active' : ''}`} onClick={() => onViewChange('map')}>
              <Icon name="map"  size={13} /> <span className="vsw-label">{t('header.carte')}</span>
            </button>
            <button className={`view-switch-btn${view === 'list' ? ' active' : ''}`} onClick={() => onViewChange('list')}>
              <Icon name="list" size={13} /> <span className="vsw-label">{t('header.liste')}</span>
            </button>
          </div>

          {/* ── Notifications ── */}
          <div style={{ position: 'relative' }} ref={notifRef}>
            <button
              className="hdr-icon-btn"
              title={t('header.notifications')}
              onClick={() => { setNotifOpen((o) => !o); setDropOpen(false) }}
              style={{ position: 'relative' }}
            >
              <Icon name="bell" size={17} />
              {/* Point rouge — affiché uniquement s'il y a de vraies notifs non lues */}
              {/* À brancher sur un useQuery('/notifications/') quand l'API sera prête */}
            </button>

            {notifOpen && (
              <NotifPanel onClose={() => setNotifOpen(false)} t={t} />
            )}
          </div>

          {/* ── Langue FR / EN ── */}
          <div className="lang-toggle">
            <button className={`lang-btn${lang === 'fr' ? ' active' : ''}`} onClick={() => setLang('fr')}>FR</button>
            <button className={`lang-btn${lang === 'en' ? ' active' : ''}`} onClick={() => setLang('en')}>EN</button>
          </div>

          {/* ── Avatar + menu utilisateur ── */}
          <div style={{ position: 'relative' }} ref={dropRef}>
            <button
              className="avatar-btn"
              title={userName}
              onClick={() => { setDropOpen((o) => !o); setNotifOpen(false) }}
              style={userPhoto ? { padding: 0, overflow: 'hidden', background: 'var(--border-subtle)' } : undefined}
            >
              {userPhoto
                ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={userPhoto}
                    alt={userName}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%', display: 'block' }}
                  />
                )
                : initials
              }
            </button>

            {dropOpen && (
              <div className="user-dropdown">
                <div className="udrop-header">
                  <div className="udrop-name">{userName}</div>
                  <div className="udrop-role">{userRole} {userExtra}</div>
                </div>

                {/* Profil agent — navigue vers la page profil */}
                <div
                  className="udrop-item"
                  onClick={() => { setDropOpen(false); router.push(ROUTES.PROFILE) }}
                >
                  <Icon name="user" size={14} /> {t('header.profil')}
                </div>

                {/* Espace admin — visible uniquement pour les admins */}
                {user?.role === 'admin' && (
                  <div
                    className="udrop-item"
                    onClick={() => { setDropOpen(false); router.push(ROUTES.ADMIN) }}
                  >
                    <Icon name="grid" size={14} /> {t('header.admin')}
                  </div>
                )}

                {/* Préférences — ouvre la modale */}
                <div
                  className="udrop-item"
                  onClick={() => { setDropOpen(false); setPrefOpen(true) }}
                >
                  <Icon name="settings" size={14} /> {t('header.preferences')}
                </div>

                <div className="udrop-divider" />

                {isAuth
                  ? (
                    <div className="udrop-item danger" onClick={handleLogout}>
                      <Icon name="log-out" size={14} /> {t('header.deconnexion')}
                    </div>
                  ) : (
                    <div className="udrop-item" onClick={() => { setDropOpen(false); router.push(ROUTES.LOGIN) }}>
                      <Icon name="log-out" size={14} /> {t('header.connexion')}
                    </div>
                  )
                }
              </div>
            )}
          </div>

        </div>
      </header>

      {/* Modale préférences — en dehors du header pour le z-index */}
      {prefOpen && (
        <PrefModal
          onClose={() => setPrefOpen(false)}
          t={t}
          lang={lang}
          setLang={setLang}
        />
      )}
    </>
  )
}
