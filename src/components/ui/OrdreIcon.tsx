'use client'

import React from 'react'
import type { OrdreBorne } from '@/lib/types'

interface OrdreIconProps {
  ordre: OrdreBorne | number
  size?: number
  color?: string
  className?: string
  style?: React.CSSProperties
}

/**
 * Geodetic order icons:
 *  1 = triangle (reference)
 *  2 = diamond (base)
 *  3 = circle (densification)
 */
export function OrdreIcon({ ordre, size = 18, color, className, style }: OrdreIconProps) {
  const defaultColors: Record<number, string> = {
    1: '#1F5D3A',
    2: '#B85729',
    3: '#1E6091',
  }
  const fill = color ?? defaultColors[ordre] ?? '#5A6770'

  if (ordre === 1) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={fill}
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        style={style}
        aria-label="Ordre 1 — Référence"
      >
        <polygon points="12,3 22,21 2,21" stroke="white" strokeWidth="1" />
      </svg>
    )
  }

  if (ordre === 2) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={fill}
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        style={style}
        aria-label="Ordre 2 — Base"
      >
        <polygon points="12,2 22,12 12,22 2,12" stroke="white" strokeWidth="1" />
      </svg>
    )
  }

  // ordre 3
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-label="Ordre 3 — Densification"
    >
      <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="1" />
    </svg>
  )
}

/** Inline text label */
export function OrdreLabel({ ordre }: { ordre: OrdreBorne | number }) {
  const labels: Record<number, string> = {
    1: '1er ordre',
    2: '2ème ordre',
    3: '3ème ordre',
  }
  return <span>{labels[ordre] ?? `Ordre ${ordre}`}</span>
}
