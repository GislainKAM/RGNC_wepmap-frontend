'use client'

import React from 'react'

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'default'

interface BadgeProps {
  variant?: BadgeVariant
  dot?: boolean
  children: React.ReactNode
  className?: string
}

export function Badge({ variant = 'default', dot = true, children, className }: BadgeProps) {
  const cls = variant === 'default' ? 'badge' : `badge badge-${variant}`
  return (
    <span className={`${cls}${className ? ` ${className}` : ''}`}>
      {dot && <span className="badge-dot" />}
      {children}
    </span>
  )
}

/** Convenience: map StatutBorne to Badge variant */
export function StatutBadge({ statut }: { statut: string }) {
  const map: Record<string, { variant: BadgeVariant; label: string }> = {
    actif:   { variant: 'success', label: 'Actif' },
    degrade: { variant: 'warning', label: 'Dégradé' },
    detruit: { variant: 'danger',  label: 'Détruit' },
    inconnu: { variant: 'default', label: 'Inconnu' },
  }
  const { variant, label } = map[statut] ?? { variant: 'default', label: statut }
  return <Badge variant={variant}>{label}</Badge>
}
