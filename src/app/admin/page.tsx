'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@/components/ui/Icon'
import { useAuth } from '@/hooks/useAuth'
import { useLanguage } from '@/hooks/useLanguage'
import { useSignalements, useDemandes } from '@/hooks/useAdmin'
import { ROUTES } from '@/lib/constants'

import { useToast } from '@/components/admin/adminUtils'
import { ToastStack } from '@/components/admin/AdminUI'
import { SectionDashboard } from '@/components/admin/SectionDashboard'
import { SectionBornes } from '@/components/admin/SectionBornes'
import { SectionSignalements } from '@/components/admin/SectionSignalements'
import { SectionImport } from '@/components/admin/SectionImport'
import { SectionRequests } from '@/components/admin/SectionRequests'
import { SectionAgents } from '@/components/admin/SectionAgents'
import type { AdminSection } from '@/components/admin/adminUtils'

// ── Main AdminPage ────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { t } = useLanguage()
  const router    = useRouter()
  const user      = useAuth((s) => s.user)
  const isAuth    = useAuth((s) => s.isAuthenticated)
  const isLoading = useAuth((s) => s.isLoading)
  const logout    = useAuth((s) => s.logout)
  const [section, setSection] = useState<AdminSection>('dashboard')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const closeSidebar = useCallback(() => setSidebarOpen(false), [])
  const { toasts, push: toast } = useToast()

  // Navigation (computed from t so it updates with language)
  const NAV: { key: AdminSection; label: string; icon: string }[] = [
    { key: 'dashboard',    label: t('admin.nav.dashboard'),    icon: 'grid'           },
    { key: 'bornes',       label: t('admin.nav.bornes'),       icon: 'map-pin'        },
    { key: 'signalements', label: t('admin.nav.signalements'), icon: 'triangle-alert' },
    { key: 'import',       label: t('admin.nav.import'),       icon: 'arrow-right'    },
    { key: 'requests',     label: t('admin.nav.requests'),     icon: 'bell'           },
    { key: 'agents',       label: t('admin.nav.agents'),       icon: 'user'           },
  ]

  const TITLES: Record<AdminSection, string> = {
    dashboard:    t('admin.title.dashboard'),
    bornes:       t('admin.title.bornes'),
    signalements: t('admin.title.signalements'),
    import:       t('admin.title.import'),
    requests:     t('admin.title.requests'),
    agents:       t('admin.title.agents'),
  }

  // Badges dynamiques
  const { data: sigsData }     = useSignalements()
  const { data: demandesData } = useDemandes({ statut: 'attente' })
  const sigBadge     = sigsData?.results?.filter((s) => s.statut_traitement === 'attente').length ?? 0
  const demandeBadge = demandesData?.count ?? 0

  useEffect(() => {
    if (!isLoading && (!isAuth || user?.role !== 'admin')) {
      router.push(ROUTES.LOGIN)
    }
  }, [isAuth, isLoading, user, router])

  if (isLoading || !user || user.role !== 'admin') {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', color: 'var(--fg-3)' }}>
        {t('admin.permission')}
      </div>
    )
  }

  const handleLogout = () => { logout(); router.push(ROUTES.LOGIN) }

  return (
    <div className="admin-layout" style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg-app)', fontFamily: 'var(--font-body)' }}>

      {/* ── Backdrop mobile sidebar ── */}
      {sidebarOpen && (
        <div className="admin-sidebar-backdrop" onClick={closeSidebar} aria-hidden="true" />
      )}

      {/* ── Sidebar ── */}
      <aside className={`admin-sidebar${sidebarOpen ? ' open' : ''}`} style={{ width: 232, background: 'var(--rgnc-foret-900)', borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div onClick={() => router.push(ROUTES.MAP)} style={{ padding: '16px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} title={t('admin.sidebar.retour')}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/logo/rgnc-webmap-wordmark.svg" alt="RGNC WebMap" style={{ height: 22, filter: 'brightness(0) invert(1) opacity(0.88)' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)', padding: '2px 7px', borderRadius: 'var(--radius-pill)', letterSpacing: '0.05em', marginLeft: 'auto', flexShrink: 0 }}>ADMIN</span>
        </div>

        <nav style={{ flex: 1, padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
          {NAV.map(({ key, label, icon }) => {
            const badge = key === 'signalements' ? sigBadge : key === 'requests' ? demandeBadge : 0
            return (
              <button key={key} onClick={() => { setSection(key); closeSidebar() }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', fontSize: 13, fontFamily: 'var(--font-body)', fontWeight: 500, background: section === key ? 'rgba(255,255,255,0.12)' : 'transparent', color: section === key ? '#fff' : 'rgba(255,255,255,0.6)', textAlign: 'left', width: '100%', transition: 'all 120ms' }}>
                <Icon name={icon as any} size={16} color={section === key ? '#fff' : 'rgba(255,255,255,0.5)'} />
                <span style={{ flex: 1 }}>{label}</span>
                {badge > 0 && (
                  <span style={{ background: 'var(--rgnc-laterite-500)', color: '#fff', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 'var(--radius-pill)', minWidth: 18, textAlign: 'center' }}>{badge}</span>
                )}
              </button>
            )
          })}
        </nav>

        <div style={{ padding: '10px 8px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <button onClick={() => router.push(ROUTES.MAP)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 'var(--radius-sm)', background: 'transparent', color: 'rgba(255,255,255,0.5)', fontSize: 12, cursor: 'pointer', border: 'none', fontFamily: 'var(--font-body)', textAlign: 'left', width: '100%' }}>
            <Icon name="map" size={15} color="rgba(255,255,255,0.4)" />{t('admin.sidebar.retour')}
          </button>
          <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 'var(--radius-sm)', background: 'transparent', color: 'rgba(255,100,100,0.75)', fontSize: 12, cursor: 'pointer', border: 'none', fontFamily: 'var(--font-body)', textAlign: 'left', width: '100%' }}>
            <Icon name="log-out" size={15} color="rgba(255,100,100,0.6)" />{t('admin.sidebar.deconnexion')}
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div className="admin-main-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Topbar */}
        <div className="admin-topbar" style={{ height: 52, background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 10, flexShrink: 0 }}>
          {/* Hamburger — visible uniquement sur mobile via CSS */}
          <button
            className="admin-hamburger"
            onClick={() => setSidebarOpen(true)}
            aria-label="Ouvrir le menu"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-2)', display: 'none', padding: 6, borderRadius: 'var(--radius-sm)', flexShrink: 0 }}
          >
            <Icon name="list" size={20} />
          </button>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600, color: 'var(--fg-1)', margin: 0, whiteSpace: 'nowrap' }}>{TITLES[section]}</h1>
          <span className="admin-topbar-sub" style={{ color: 'var(--fg-4)' }}>·</span>
          <span className="admin-topbar-sub" style={{ fontSize: 13, color: 'var(--fg-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t('admin.topbar.subtitle')}</span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <span className="admin-topbar-date" style={{ fontSize: 11, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
              {new Date().toLocaleDateString()}
            </span>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--rgnc-foret-700)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
              {(user?.nom_complet || user?.username || 'AD').split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)}
            </div>
          </div>
        </div>

        {/* Corps */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
          {section === 'dashboard'    && <SectionDashboard    onGoTo={setSection} onToast={toast} />}
          {section === 'bornes'       && <SectionBornes       onToast={toast} />}
          {section === 'signalements' && <SectionSignalements onToast={toast} />}
          {section === 'import'       && <SectionImport       onToast={toast} />}
          {section === 'requests'     && <SectionRequests     onToast={toast} />}
          {section === 'agents'       && <SectionAgents       onToast={toast} />}
        </main>
      </div>

      <ToastStack toasts={toasts} />
    </div>
  )
}
