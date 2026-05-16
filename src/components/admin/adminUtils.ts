'use client'

import { useRef, useState } from 'react'
import React from 'react'
import type { StatutBorne } from '@/lib/types'

// ── Types partagés ────────────────────────────────────────────────────────────

export type AdminSection = 'dashboard' | 'bornes' | 'signalements' | 'import' | 'requests' | 'agents'
export type ToastType    = 'success' | 'info' | 'warning' | 'danger'
export interface Toast { id: number; msg: string; type: ToastType }

// ── Constants ─────────────────────────────────────────────────────────────────

export const STATUT_CLS: Record<StatutBorne, string> = {
  actif:   'badge-success',
  degrade: 'badge-warning',
  detruit: 'badge-danger',
  inconnu: '',
}

export const inputSt: React.CSSProperties = {
  height: 34, border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)',
  padding: '0 10px', fontFamily: 'var(--font-body)', fontSize: 13,
  color: 'var(--fg-1)', background: 'var(--bg-sunken)', outline: 'none',
}

// ── Toast system ──────────────────────────────────────────────────────────────

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const counter = useRef(0)
  const push = (msg: string, type: ToastType = 'info') => {
    const id = ++counter.current
    setToasts((t) => [...t, { id, msg, type }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000)
  }
  return { toasts, push }
}
