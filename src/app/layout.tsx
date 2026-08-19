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

const TITRE = 'RGNC WebMap'
const DESCRIPTION =
  "Interface WebSIG pour la consultation et la gestion du Réseau Géodésique National du Cameroun (RGNC). Visualisez les bornes géodésiques, leurs coordonnées et fiches signalétiques."

// Open Graph : sans ces balises, un lien partagé sur WhatsApp ou LinkedIn
// n'affiche que le titre et la description, sans image. `metadataBase` est
// indispensable — og:image doit être une URL absolue, ces plateformes ne
// résolvent pas les chemins relatifs.
//
// L'image est une capture de /map plutôt que de l'accueil : c'est la carte
// qui montre ce que fait l'application. Format 1200x630 (ratio 1.91:1
// attendu, sinon recadrage) et 111 Ko — au-delà d'environ 300 Ko, WhatsApp
// ignore l'image sans rien signaler.
export const metadata: Metadata = {
  metadataBase: new URL('https://rgnc.websig.app'),
  title: TITRE,
  description: DESCRIPTION,
  keywords: ['géodésie', 'Cameroun', 'RGNC', 'WebGIS', 'bornes géodésiques'],
  authors: [{ name: 'RGNC — Réseau Géodésique National du Cameroun' }],
  openGraph: {
    type: 'website',
    siteName: 'RGNC WebMap',
    locale: 'fr_FR',
    url: '/',
    title: TITRE,
    description: DESCRIPTION,
    images: [
      {
        url: '/og/apercu.jpg',
        width: 1200,
        height: 630,
        alt: 'Carte des bornes géodésiques du Réseau Géodésique National du Cameroun',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITRE,
    description: DESCRIPTION,
    images: ['/og/apercu.jpg'],
  },
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
