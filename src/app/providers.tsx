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
  const lang = useLanguage((s) => s.lang)

  useEffect(() => {
    useLanguage.persist.rehydrate()
  }, [])

  // Report de la langue choisie sur <html lang>, que layout.tsx ne peut que
  // figer : c'est un composant serveur, il ignore la préférence stockée dans
  // le localStorage du visiteur.
  //
  // L'attribut n'est pas décoratif. C'est lui qui indique au lecteur d'écran
  // quelle voix et quelle phonétique employer : annoncé « fr » alors que le
  // contenu est en anglais, « Download » se prononce à la française et
  // devient inintelligible. Il gouverne aussi la césure et les guillemets
  // typographiques du navigateur (WCAG 3.1.1).
  //
  // La mutation a lieu dans un effet, donc après l'hydratation : le rendu
  // serveur et le premier rendu client restent identiques, sans écart signalé
  // par React.
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

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
