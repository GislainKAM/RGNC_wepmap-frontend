import type { Metadata } from 'next'

// La page est un composant client : elle ne peut pas exporter de metadata
// elle-même. Ce layout le fait pour elle — c'est le seul moyen de donner
// un canonical à la route.
//
// Le canonical est posé route par route et jamais dans le layout racine :
// une metadata de layout est héritée par toutes les routes filles, et un
// canonical hérité désigne la mauvaise URL. Une route ajoutée sans
// canonical n'en aura donc aucun, et Google se rabattra sur
// l'auto-canonical — c'est le bon mode d'échec.
//
// /map porte le contenu réellement indexable de l'application : l'accueil
// n'est qu'une redirection côté client vers /map ou /auth/login.
export const metadata: Metadata = {
  alternates: { canonical: '/map' },
}

export default function MapLayout({ children }: { children: React.ReactNode }) {
  return children
}
