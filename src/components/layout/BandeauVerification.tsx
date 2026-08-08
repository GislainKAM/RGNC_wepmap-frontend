'use client'

import React, { useEffect, useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { useAuth } from '@/hooks/useAuth'
import { useLanguage } from '@/hooks/useLanguage'
import { verificationApi } from '@/lib/api'

/**
 * Rappel d'adresse non confirmée.
 *
 * Le compte fonctionne — consultation de la carte, des fiches, de la liste —
 * mais le signalement de terrain reste fermé tant que l'adresse n'a pas
 * répondu. Sans ce rappel, l'utilisateur découvrirait la restriction au
 * moment de signaler une borne détruite, depuis le terrain, sans comprendre
 * pourquoi et sans moyen d'y remédier sur place.
 *
 * Ne s'affiche jamais pour un visiteur non connecté : il n'a rien à
 * confirmer, et le bandeau lui serait incompréhensible.
 */
export function BandeauVerification() {
  const { t } = useLanguage()
  const user     = useAuth((s) => s.user)
  const isAuth   = useAuth((s) => s.isAuthenticated)
  const loadUser = useAuth((s) => s.loadUser)

  const [envoi,    setEnvoi]    = useState(false)
  const [retour,   setRetour]   = useState<string | null>(null)
  const [attente,  setAttente]  = useState(0)
  const [masque,   setMasque]   = useState(false)

  // Décompte du délai entre deux envois : un bouton grisé sans explication
  // pousse à cliquer davantage.
  useEffect(() => {
    if (attente <= 0) return
    const minuteur = setTimeout(() => setAttente((s) => s - 1), 1000)
    return () => clearTimeout(minuteur)
  }, [attente])

  if (!isAuth || !user || user.email_verifie || masque) return null

  const renvoyer = async () => {
    setEnvoi(true)
    setRetour(null)
    try {
      const r = await verificationApi.renvoyer()
      setRetour(r.detail)
      // Recharge le profil : l'adresse a pu être confirmée entre-temps
      // depuis un autre appareil, auquel cas le bandeau disparaît.
      loadUser()
    } catch (e: any) {
      const donnees = e?.response?.data
      setRetour(donnees?.detail ?? t('verif.echec_reseau'))
      if (typeof donnees?.attente_secondes === 'number') {
        setAttente(donnees.attente_secondes)
      }
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <div className="bandeau-verif" role="status">
      <Icon name="send" size={15} />
      <span className="bandeau-verif-texte">
        {t('verif.bandeau')} <b>{user.email}</b>
      </span>

      {retour && <span className="bandeau-verif-retour">{retour}</span>}

      <button
        type="button"
        className="bandeau-verif-action"
        onClick={renvoyer}
        disabled={envoi || attente > 0}
      >
        {attente > 0
          ? `${t('verif.patienter')} ${attente} s`
          : envoi ? t('verif.envoi_en_cours') : t('verif.renvoyer')}
      </button>

      {/* Masquable pour la session : le rappel ne doit pas devenir un
          obstacle permanent pour qui consulte simplement la carte. */}
      <button
        type="button"
        className="bandeau-verif-fermer"
        onClick={() => setMasque(true)}
        aria-label={t('verif.masquer')}
        title={t('verif.masquer')}
      >
        <Icon name="x" size={14} />
      </button>
    </div>
  )
}
