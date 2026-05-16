'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { ROUTES } from '@/lib/constants'

export default function HomePage() {
  const router        = useRouter()
  const isAuth        = useAuth((s) => s.isAuthenticated)
  const isLoading     = useAuth((s) => s.isLoading)

  useEffect(() => {
    if (isLoading) return
    // Utilisateur connecté → carte, sinon → login
    router.replace(isAuth ? ROUTES.MAP : ROUTES.LOGIN)
  }, [router, isAuth, isLoading])

  // Écran de chargement immédiat — visible pendant la vérification auth
  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-app)',
      flexDirection: 'column',
      gap: 16,
    }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/assets/logo/rgnc-webmap-mark.svg"
        alt="RGNC WebMap"
        style={{ width: 48, height: 48, opacity: 0.7 }}
      />
      <div style={{
        width: 24,
        height: 24,
        border: '2px solid var(--border-subtle)',
        borderTopColor: 'var(--rgnc-foret-700)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
