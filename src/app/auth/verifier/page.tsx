'use client'

import React, { Suspense, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Icon } from '@/components/ui/Icon'
import { Button } from '@/components/ui/Button'
import { useLanguage } from '@/hooks/useLanguage'
import { verificationApi } from '@/lib/api'
import { ROUTES } from '@/lib/constants'

type Etat = 'attente' | 'succes' | 'echec'

function ContenuVerification() {
  const { t } = useLanguage()
  const parametres = useSearchParams()
  const jeton = parametres.get('jeton') ?? ''

  const [etat, setEtat]       = useState<Etat>('attente')
  const [message, setMessage] = useState('')

  // Garde contre le double appel du mode strict de React en développement :
  // sans elle, le jeton serait consommé une première fois puis rejoué, et
  // l'utilisateur verrait « déjà confirmée » au lieu de la confirmation.
  const dejaEnvoye = useRef(false)

  useEffect(() => {
    if (dejaEnvoye.current) return
    dejaEnvoye.current = true

    if (!jeton) {
      setEtat('echec')
      setMessage(t('verif.lien_incomplet'))
      return
    }

    verificationApi
      .confirmer(jeton)
      .then((r) => {
        setEtat(r.verifie ? 'succes' : 'echec')
        setMessage(r.detail)
      })
      .catch((e) => {
        setEtat('echec')
        setMessage(e?.response?.data?.detail ?? t('verif.echec_reseau'))
      })
  }, [jeton, t])

  return (
    <div className="verif-page">
      <div className="verif-carte">
        {etat === 'attente' && (
          <>
            <div className="verif-spinner" aria-hidden="true" />
            <h1 className="verif-titre">{t('verif.en_cours')}</h1>
          </>
        )}

        {etat === 'succes' && (
          <>
            <span className="verif-icone verif-icone-ok" aria-hidden="true">
              <Icon name="check-circle" size={26} />
            </span>
            <h1 className="verif-titre">{t('verif.titre_ok')}</h1>
            <p className="verif-texte">{message}</p>
            {/* La confirmation d'adresse ne donne pas accès aux fiches :
                le dire ici évite une déception au premier téléchargement. */}
            <p className="verif-note">{t('verif.note_admin')}</p>
            <Link href={ROUTES.MAP}>
              <Button variant="primary">{t('verif.aller_carte')}</Button>
            </Link>
          </>
        )}

        {etat === 'echec' && (
          <>
            <span className="verif-icone verif-icone-ko" aria-hidden="true">
              <Icon name="triangle-alert" size={26} />
            </span>
            <h1 className="verif-titre">{t('verif.titre_ko')}</h1>
            <p className="verif-texte">{message}</p>
            <p className="verif-note">{t('verif.aide_renvoi')}</p>
            <Link href={ROUTES.LOGIN}>
              <Button variant="secondary">{t('verif.aller_connexion')}</Button>
            </Link>
          </>
        )}
      </div>
    </div>
  )
}

/**
 * Page de confirmation d'adresse — ouverte depuis le lien reçu par message.
 *
 * `useSearchParams` impose une frontière Suspense : sans elle, Next bascule
 * la page entière en rendu dynamique et le build échoue.
 */
export default function PageVerification() {
  return (
    <Suspense fallback={<div className="verif-page"><div className="verif-carte" /></div>}>
      <ContenuVerification />
    </Suspense>
  )
}
