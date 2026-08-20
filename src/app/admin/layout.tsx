import type { Metadata } from 'next'

// Page d'application derrière authentification : rien à indexer, et un
// résultat de recherche pointant vers un écran vide ou un formulaire de
// connexion dessert le site. Le robots.txt la refuse déjà au crawl, mais
// une page seulement interdite au crawl peut quand même être indexée sur
// la foi de liens entrants — seule la balise robots l'empêche vraiment.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
