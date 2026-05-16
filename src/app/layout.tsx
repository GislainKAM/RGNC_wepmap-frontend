import type { Metadata } from 'next'
import {
  Bricolage_Grotesque,
  Public_Sans,
  IBM_Plex_Sans_Condensed,
  JetBrains_Mono,
} from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

// next/font/google : auto-hébergement au build, font-display:swap, zéro requête tierce
const bricolage = Bricolage_Grotesque({
  subsets:  ['latin'],
  weight:   ['400', '500', '600', '700'],
  variable: '--font-bricolage',
  display:  'swap',
})

const publicSans = Public_Sans({
  subsets:  ['latin'],
  weight:   ['400', '500', '600', '700'],
  variable: '--font-public-sans',
  display:  'swap',
})

const ibmPlexCondensed = IBM_Plex_Sans_Condensed({
  subsets:  ['latin'],
  weight:   ['400', '500', '600'],
  variable: '--font-ibm-plex',        // Correspond à var(--font-ibm-plex) dans globals.css
  display:  'swap',
})

const jetbrainsMono = JetBrains_Mono({
  subsets:  ['latin'],
  weight:   ['400', '500'],
  variable: '--font-jetbrains',       // Correspond à var(--font-jetbrains) dans globals.css
  display:  'swap',
})

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
    <html
      lang="fr"
      suppressHydrationWarning
      className={`${bricolage.variable} ${publicSans.variable} ${ibmPlexCondensed.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
