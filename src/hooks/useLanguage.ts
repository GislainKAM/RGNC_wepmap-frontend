'use client'

/**
 * RGNC WebMap — Hook i18n
 * Store Zustand persistant pour la langue (FR / EN).
 * Usage : const { t, lang, setLang } = useLanguage()
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import fr, { type TranslationKey } from '@/lib/i18n/fr'
import en from '@/lib/i18n/en'

export type Lang = 'fr' | 'en'

const dictionaries: Record<Lang, Record<TranslationKey, string>> = { fr, en }

interface LanguageStore {
  lang:    Lang
  setLang: (l: Lang) => void
  t:       (key: TranslationKey) => string
}

export const useLanguage = create<LanguageStore>()(
  persist(
    (set, get) => ({
      lang: 'fr',

      setLang: (l: Lang) => set({ lang: l }),

      t: (key: TranslationKey) => {
        const dict = dictionaries[get().lang]
        return dict[key] ?? fr[key] ?? key   // fallback FR → clé brute
      },
    }),
    {
      name: 'rgnc-lang',       // clé localStorage
      skipHydration: true,     // évite le mismatch SSR ↔ client
    }
  )
)
