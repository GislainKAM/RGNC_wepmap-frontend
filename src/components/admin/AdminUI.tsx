'use client'

import React, { useState } from 'react'
import { Icon } from '@/components/ui/Icon'
import { useLanguage } from '@/hooks/useLanguage'
import type { Toast, ToastType } from './adminUtils'

// ── Spinner ───────────────────────────────────────────────────────────────────

export function Spinner() {
  return (
    <div style={{ padding: '40px 0', display: 'flex', justifyContent: 'center', color: 'var(--fg-3)' }}>
      <Icon name="loader" size={24} style={{ animation: 'spin 1s linear infinite' }} />
    </div>
  )
}

// ── ApiError ──────────────────────────────────────────────────────────────────

export function ApiError({ error, label }: { error: unknown; label: string }) {
  const { t } = useLanguage()
  const msg = error instanceof Error ? error.message : t('admin.erreur_serveur')
  return (
    <div style={{ padding: '24px 18px', background: 'var(--rgnc-danger-bg)', border: '1px solid var(--rgnc-danger)', borderRadius: 'var(--radius-sm)', color: '#5C1818', fontSize: 13 }}>
      <b>{label}</b> — {msg}
    </div>
  )
}

// ── BarChartSVG ───────────────────────────────────────────────────────────────

const TIP_W = 132  // largeur tooltip
// Couleurs et libellés par ordre géodésique
const ORDRE_META: Record<number, { label: string; color: string }> = {
  1: { label: '1er ordre', color: '#2D6A4F' },
  2: { label: '2ème ordre', color: '#1D6A9E' },
  3: { label: '3ème ordre', color: '#B07D2E' },
}

export function BarChartSVG({
  data,
}: {
  data: { n: string; v: number; tooltip?: string; orders?: { ordre: number; nb: number }[] }[]
}) {
  const [hovered, setHovered] = useState<number | null>(null)

  if (!data.length) return null

  const maxV   = Math.max(...data.map((d) => d.v), 1)
  const totalV = data.reduce((s, d) => s + d.v, 0) || 1   // somme réelle pour le %

  const bW = 22, gap = 9, cH = 96, pL = 28, pT = 10, xLblH = 18

  // Hauteur du tooltip selon présence de détail par ordre
  const hovItem     = hovered !== null ? data[hovered] : null
  const hasOrders   = (hovItem?.orders?.length ?? 0) > 0
  const TIP_H_BASE  = 50   // sans détail ordre
  const TIP_H_FULL  = 50 + (hovItem?.orders?.length ?? 0) * 12 + 6
  const TIP_H       = hasOrders ? TIP_H_FULL : TIP_H_BASE
  // Réserve max en haut pour le tooltip (on prend le max possible)
  const TIP_H_MAX   = TIP_H_BASE + 3 * 12 + 6   // 3 ordres max

  const svgW    = pL + data.length * (bW + gap) - gap + 6
  const offsetY = TIP_H_MAX + 8
  const svgH    = offsetY + pT + cH + xLblH + 4

  return (
    <svg
      viewBox={`0 0 ${svgW} ${svgH}`}
      style={{ width: '100%', overflow: 'visible' }}
      onMouseLeave={() => setHovered(null)}
    >
      {/* Lignes de grille + labels axe Y */}
      {[0, Math.round(maxV / 4), Math.round(maxV / 2), Math.round(maxV * 3 / 4), maxV].map((v) => {
        const y = offsetY + pT + cH - (v / maxV) * cH
        return (
          <g key={v}>
            <line x1={pL} y1={y} x2={svgW - 4} y2={y} stroke="var(--border-subtle)" strokeWidth="1" />
            <text x={pL - 4} y={y + 3.5} textAnchor="end" fontFamily="var(--font-mono)" fontSize="7.5" fill="var(--fg-4)">{v}</text>
          </g>
        )
      })}

      {/* Barres */}
      {data.map((r, i) => {
        const bh   = Math.max((r.v / maxV) * cH, 2)
        const x    = pL + i * (bW + gap)
        const barY = offsetY + pT + cH - bh
        const isH  = hovered === i

        return (
          <g key={r.n} style={{ cursor: 'pointer' }} onMouseEnter={() => setHovered(i)}>
            {/* Zone de survol élargie */}
            <rect x={x} y={offsetY + pT} width={bW} height={cH} rx="2" fill="transparent" />
            {/* Fond surbrillance */}
            <rect x={x} y={offsetY + pT} width={bW} height={cH} rx="2"
              fill="var(--rgnc-foret-700)" opacity={isH ? 0.10 : 0} />
            {/* Barre */}
            <rect x={x} y={barY} width={bW} height={bh} rx="2"
              fill="var(--rgnc-foret-700)" opacity={isH ? 1 : 0.72} />
            {/* Valeur au-dessus */}
            <text x={x + bW / 2} y={barY - 3} textAnchor="middle"
              fontFamily="var(--font-mono)" fontSize="7.5"
              fill={isH ? 'var(--fg-1)' : 'var(--fg-2)'}
              fontWeight={isH ? '700' : '400'}>
              {r.v}
            </text>
            {/* Code région axe X */}
            <text x={x + bW / 2} y={offsetY + pT + cH + xLblH - 4} textAnchor="middle"
              fontFamily="var(--font-body)" fontSize="8.5" fontWeight={isH ? '700' : '600'}
              fill={isH ? 'var(--rgnc-foret-700)' : 'var(--fg-2)'}>
              {r.n}
            </text>
          </g>
        )
      })}

      {/* Tooltip flottant */}
      {hovered !== null && hovItem && (() => {
        const cx      = pL + hovered * (bW + gap) + bW / 2
        const bh      = Math.max((hovItem.v / maxV) * cH, 2)
        const barTopY = offsetY + pT + cH - bh
        const tx      = Math.min(Math.max(cx - TIP_W / 2, 1), svgW - TIP_W - 1)
        const ty      = Math.max(barTopY - TIP_H - 6, 1)

        const label  = hovItem.tooltip ?? hovItem.n
        const pct    = ((hovItem.v / totalV) * 100).toFixed(1)
        const orders = (hovItem.orders ?? []).sort((a, b) => a.ordre - b.ordre)

        return (
          <g style={{ pointerEvents: 'none' }}>
            {/* Ombre */}
            <rect x={tx + 1} y={ty + 2} width={TIP_W} height={TIP_H} rx="5"
              fill="rgba(0,0,0,0.12)" />
            {/* Fond */}
            <rect x={tx} y={ty} width={TIP_W} height={TIP_H} rx="5"
              fill="var(--bg-elevated)" stroke="var(--border-subtle)" strokeWidth="1" />
            {/* Flèche */}
            <polygon
              points={`${cx - 5},${ty + TIP_H} ${cx + 5},${ty + TIP_H} ${cx},${ty + TIP_H + 5}`}
              fill="var(--bg-elevated)" stroke="var(--border-subtle)" strokeWidth="1"
            />

            {/* ── Contenu ── */}
            {/* Nom région */}
            <text x={tx + TIP_W / 2} y={ty + 14} textAnchor="middle"
              fontFamily="var(--font-display)" fontSize="9.5" fontWeight="700" fill="var(--fg-1)">
              {label}
            </text>
            {/* Total + % */}
            <text x={tx + 8} y={ty + 26} fontFamily="var(--font-mono)" fontSize="8.5" fill="var(--rgnc-foret-700)" fontWeight="600">
              {hovItem.v.toLocaleString()} bornes
            </text>
            <text x={tx + TIP_W - 8} y={ty + 26} textAnchor="end" fontFamily="var(--font-mono)" fontSize="8.5" fill="var(--fg-3)">
              {pct}%
            </text>

            {/* Séparateur */}
            {orders.length > 0 && (
              <line x1={tx + 8} y1={ty + 32} x2={tx + TIP_W - 8} y2={ty + 32}
                stroke="var(--border-subtle)" strokeWidth="0.75" />
            )}

            {/* Lignes par ordre */}
            {orders.map((o, oi) => {
              const meta = ORDRE_META[o.ordre] ?? { label: `Ordre ${o.ordre}`, color: 'var(--fg-2)' }
              const ly   = ty + 43 + oi * 12
              return (
                <g key={o.ordre}>
                  {/* Pastille colorée */}
                  <circle cx={tx + 13} cy={ly - 3.5} r="3" fill={meta.color} opacity="0.85" />
                  {/* Libellé */}
                  <text x={tx + 20} y={ly} fontFamily="var(--font-body)" fontSize="8" fill="var(--fg-2)">
                    {meta.label}
                  </text>
                  {/* Valeur alignée à droite */}
                  <text x={tx + TIP_W - 8} y={ly} textAnchor="end"
                    fontFamily="var(--font-mono)" fontSize="8" fontWeight="600" fill={meta.color}>
                    {o.nb.toLocaleString()}
                  </text>
                </g>
              )
            })}
          </g>
        )
      })()}
    </svg>
  )
}

// ── ToastStack ────────────────────────────────────────────────────────────────

export function ToastStack({ toasts }: { toasts: Toast[] }) {
  const colors: Record<ToastType, string> = {
    success: 'var(--rgnc-success)', info: 'var(--rgnc-info)',
    warning: 'var(--rgnc-warning)', danger: 'var(--rgnc-danger)',
  }
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
      {toasts.map((t) => (
        <div key={t.id} style={{ background: 'var(--bg-elevated)', border: `1px solid ${colors[t.type]}`, borderLeft: `4px solid ${colors[t.type]}`, borderRadius: 'var(--radius-sm)', padding: '10px 16px', fontSize: 13, color: 'var(--fg-1)', boxShadow: 'var(--shadow-md)', maxWidth: 360 }}>
          {t.msg}
        </div>
      ))}
    </div>
  )
}
