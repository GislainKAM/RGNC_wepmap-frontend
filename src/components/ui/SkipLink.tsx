'use client'

import { useLanguage } from '@/hooks/useLanguage'

/**
 * Lien d'évitement — premier élément focusable de la page.
 *
 * Sans lui, un utilisateur au clavier (ou au lecteur d'écran) doit traverser
 * la totalité de l'en-tête — recherche, bascule carte/liste, notifications,
 * préférences, menu profil — à chaque changement de page avant d'atteindre
 * le contenu. Le lien reste hors écran (`left: -9999px`) et ne réapparaît
 * qu'à la prise de focus, il est donc invisible à la souris.
 *
 * `ANCRE_CONTENU` doit être posé sur le conteneur du contenu principal, qui
 * porte aussi `tabIndex={-1}` : sans cet attribut, un `<div>` ou un `<main>`
 * n'est pas focusable et les navigateurs déplacent le défilement sans
 * déplacer le focus — le clavier repartirait alors du début de l'en-tête.
 *
 * Volontairement absent des pages sans en-tête (connexion, inscription,
 * écran de redirection) : il n'y a là aucune navigation à contourner.
 */
export const ANCRE_CONTENU = 'contenu-principal'

export function SkipLink() {
  // Abonnement au store entier (et non au seul sélecteur `s.t`) : `t` lit la
  // langue au moment de l'appel, un sélecteur ne provoquerait aucun rendu au
  // changement de langue et le libellé resterait figé.
  const { t } = useLanguage()

  return (
    <a href={`#${ANCRE_CONTENU}`} className="skip-link">
      {t('a11y.skip')}
    </a>
  )
}
