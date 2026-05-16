'use client'

import { useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { useLanguage } from '@/hooks/useLanguage'

// ── Auth initializer ──────────────────────────────────────────────────────────

function AuthInitializer({ children }: { children: React.ReactNode }) {
  const loadUser = useAuth((s) => s.loadUser)
  useEffect(() => { loadUser() }, [loadUser])
  return <>{children}</>
}

// ── Language hydration ────────────────────────────────────────────────────────
// Zustand persist avec skipHydration: true ne lit PAS localStorage au SSR.
// Ce composant déclenche la réhydratation manuelle après le premier montage
// côté client, ce qui supprime l'erreur de hydration React.

function LanguageHydration({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    useLanguage.persist.rehydrate()
  }, [])
  return <>{children}</>
}

// ── Providers ─────────────────────────────────────────────────────────────────

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <AuthInitializer>
        <LanguageHydration>
          {children}
        </LanguageHydration>
      </AuthInitializer>
    </QueryClientProvider>
  )
}
