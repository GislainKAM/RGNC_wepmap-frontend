import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'RGNC WebMap',
  description:
    "Interface WebSIG pour la consultation et la gestion du Réseau Géodésique National du Cameroun (RGNC). Visualisez les bornes géodésiques, leurs coordonnées et fiches signalétiques.",
  keywords: ['géodésie', 'Cameroun', 'RGNC', 'WebGIS', 'bornes géodésiques'],
  authors: [{ name: 'RGNC — Réseau Géodésique National du Cameroun' }],
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <head>
        {/* Google Fonts chargées côté navigateur — évite le blocage SSL du proxy au build */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,600;12..96,700&family=Public+Sans:wght@400;500;600;700&family=IBM+Plex+Sans+Condensed:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
