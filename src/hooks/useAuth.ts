/**
 * RGNC WebMap — Hook : authentification (Zustand store)
 */
'use client'

import { create } from 'zustand'
import { authApi, profilApi } from '@/lib/api'
import type { ProfilUtilisateur, ConnexionFormData, InscriptionFormData } from '@/lib/types'
import { JWT_ACCESS_KEY } from '@/lib/constants'

interface AuthState {
  user:          ProfilUtilisateur | null
  isLoading:     boolean
  isAuthenticated: boolean
  error:         string | null

  login:         (data: ConnexionFormData)              => Promise<void>
  register:      (data: InscriptionFormData)            => Promise<void>
  logout:        () => void
  loadUser:      () => Promise<void>
  updateProfil:  (data: Partial<ProfilUtilisateur>)     => Promise<ProfilUtilisateur>
  clearError:    () => void
}

export const useAuth = create<AuthState>((set) => ({
  user:            null,
  isLoading:       false,
  isAuthenticated: typeof window !== 'undefined' && !!localStorage.getItem(JWT_ACCESS_KEY),
  error:           null,

  login: async (data) => {
    set({ isLoading: true, error: null })
    try {
      await authApi.login(data)
      const profil = await profilApi.get()
      set({ user: profil, isAuthenticated: true, isLoading: false })
    } catch (err: any) {
      const responseData = err.response?.data
      set({
        error: responseData?.message || responseData?.detail || 'Identifiants incorrects.',
        isLoading: false,
      })
      throw err
    }
  },

  register: async (data) => {
    set({ isLoading: true, error: null })
    try {
      await authApi.register(data)
      set({ isLoading: false })
    } catch (err: any) {
      const responseData = err.response?.data
      // Extraire le message d'erreur : message > errors (premier champ) > detail > générique
      let errorMsg = 'Erreur lors de l\'inscription.'
      if (responseData?.message) {
        errorMsg = responseData.message
      } else if (responseData?.errors) {
        const firstField = Object.values(responseData.errors)[0] as string[]
        errorMsg = firstField?.[0] || errorMsg
      } else if (responseData?.detail) {
        errorMsg = responseData.detail
      }
      set({ error: errorMsg, isLoading: false })
      throw err
    }
  },

  logout: () => {
    authApi.logout()
    set({ user: null, isAuthenticated: false })
  },

  loadUser: async () => {
    const token = typeof window !== 'undefined' && localStorage.getItem(JWT_ACCESS_KEY)
    if (!token) return
    try {
      const profil = await profilApi.get()
      set({ user: profil, isAuthenticated: true })
    } catch {
      set({ isAuthenticated: false })
    }
  },

  updateProfil: async (data) => {
    set({ isLoading: true, error: null })
    try {
      const updated = await profilApi.update(data)
      set({ user: updated, isLoading: false })
      return updated
    } catch (err: any) {
      set({
        error: err.response?.data?.detail || 'Erreur lors de la mise à jour du profil.',
        isLoading: false,
      })
      throw err
    }
  },

  clearError: () => set({ error: null }),
}))
