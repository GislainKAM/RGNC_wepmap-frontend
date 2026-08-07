/**
 * RGNC WebMap — Copie dans le presse-papiers
 */

/**
 * Copie `texte` dans le presse-papiers. Retourne `false` si la copie a échoué.
 *
 * `navigator.clipboard` n'existe que dans un contexte sécurisé — HTTPS ou
 * localhost. Un géomètre qui consulte une instance servie en HTTP simple, ou
 * un navigateur ancien, n'y a pas accès : d'où le repli par `execCommand`,
 * obsolète mais universellement implémenté. Sans lui, le bouton ne ferait
 * rien du tout, sans le moindre message.
 */
export async function copierTexte(texte: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(texte)
      return true
    }
  } catch {
    // Échec silencieux : on tente le repli ci-dessous.
  }

  try {
    const zone = document.createElement('textarea')
    zone.value = texte
    // Hors écran plutôt que display:none : un élément non rendu ne peut pas
    // recevoir de sélection, et la copie échouerait.
    zone.style.position = 'fixed'
    zone.style.top = '-9999px'
    zone.setAttribute('readonly', '')
    document.body.appendChild(zone)
    zone.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(zone)
    return ok
  } catch {
    return false
  }
}
