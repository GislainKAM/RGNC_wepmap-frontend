import type { Metadata } from 'next'

// Connexion et inscription : rien à indexer. Le layout couvre toute la
// section /auth, y compris les routes qui viendront s'y ajouter.
//
// Le robots.txt les refuse déjà au crawl, mais une page seulement
// interdite au crawl peut quand même être indexée sur la foi de liens
// entrants — seule la balise robots l'empêche vraiment.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children
}
