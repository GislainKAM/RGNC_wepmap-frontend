'use client'

import React, { useEffect, useState } from 'react'
import { Icon } from './Icon'

export type ToastType = 'success' | 'warning' | 'danger' | 'info'

export interface ToastMessage {
  id: string
  message: string
  type: ToastType
  duration?: number
}

interface ToastItemProps {
  toast: ToastMessage
  onDismiss: (id: string) => void
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const duration = toast.duration ?? 4000
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(() => onDismiss(toast.id), 300)
    }, duration)
    return () => clearTimeout(timer)
  }, [toast.id, toast.duration, onDismiss])

  const iconName =
    toast.type === 'success'
      ? 'check'
      : toast.type === 'warning'
      ? 'triangle-alert'
      : toast.type === 'danger'
      ? 'x'
      : 'info'

  return (
    <div
      className={`toast ${toast.type}`}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateX(0)' : 'translateX(20px)',
        transition: 'opacity 0.3s, transform 0.3s',
      }}
      role="alert"
    >
      <Icon name={iconName} size={16} />
      <span style={{ flex: 1 }}>{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--fg-3)',
          display: 'flex',
          alignItems: 'center',
          padding: 0,
        }}
        aria-label="Fermer"
      >
        <Icon name="x" size={14} />
      </button>
    </div>
  )
}

interface ToasterProps {
  toasts: ToastMessage[]
  onDismiss: (id: string) => void
}

export function Toaster({ toasts, onDismiss }: ToasterProps) {
  if (toasts.length === 0) return null
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  )
}

/** Hook to manage toasts */
export function useToasts() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])

  const addToast = (message: string, type: ToastType = 'info', duration?: number) => {
    const id = `${Date.now()}-${Math.random()}`
    setToasts((prev) => [...prev, { id, message, type, duration }])
  }

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  return { toasts, addToast, dismissToast }
}

/** Simple inline toast — re-exported for backward compat */
export { ToastItem as Toast }
