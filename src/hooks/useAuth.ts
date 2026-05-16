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

  login:    (data: ConnexionFormData)    => Promise<void>
  register: (data: InscriptionFormData) => Promise<void>
  logout:   () => void
  loadUser: () => Promise<void>
  clearError: () => void
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
      set({
        error: err.response?.data?.detail || 'Identifiants incorrects.',
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
      set({
        error: err.response?.data?.detail || 'Erreur lors de l\'inscription.',
        isLoading: false,
      })
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

  clearError: () => set({ error: null }),
}))
