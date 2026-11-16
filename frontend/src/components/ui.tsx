import { useEffect } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { X } from 'lucide-react'
import type { Laboratorio } from '@shared/types'

export function Button({
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }) {
  return <button {...props} className={`btn btn-${variant} ${props.className ?? ''}`.trim()} />
}

export function Badge({ tone, children }: { tone: 'ok' | 'warn' | 'danger' | 'info' | 'neutral'; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

export function LocalBadge({ show }: { show: boolean }) {
  if (!show) return null
  return <Badge tone="warn">Reciente</Badge>
}

export function Field({
  label,
  error,
  hint,
  children,
  className,
}: {
  label: string
  error?: string
  hint?: string
  children: ReactNode
  className?: string
}) {
  return (
    <label className={`field ${className ?? ''}`.trim()}>
      <span>{label}</span>
      {children}
      {error ? <small className="field-error">{error}</small> : hint ? <small className="hint">{hint}</small> : null}
    </label>
  )
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  useEffect(() => {
    document.title = `${title} · LAB CONTROL`
  }, [title])

  return (
    <header className="page-head">
      <div>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  )
}

export function Modal({
  title,
  onClose,
  children,
  footer,
  className,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  className?: string
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [onClose])

  return (
    <div className="modal-root" onMouseDown={onClose}>
      <div className={className ? `modal ${className}` : 'modal'} role="dialog" aria-modal="true" aria-labelledby="modal-title" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <h2 id="modal-title">{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <X size={20} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer ? <footer className="modal-foot">{footer}</footer> : null}
      </div>
    </div>
  )
}

export function FormNote() {
  return (
    <p className="form-note">
      El cambio se guarda en MySQL.
    </p>
  )
}

export function LabPicker({
  value,
  onChange,
  labs,
}: {
  value: string
  onChange: (id: string) => void
  labs: Laboratorio[]
}) {
  return (
    <div className="lab-choice" role="radiogroup" aria-label="Laboratorio">
      {labs.map((lab) => (
        <button
          key={lab.id}
          type="button"
          role="radio"
          aria-checked={value === lab.id}
          className={value === lab.id ? 'is-selected' : ''}
          onClick={() => onChange(lab.id)}
        >
          {lab.nombre}
        </button>
      ))}
    </div>
  )
}

export function Segments({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (value: string) => void
  options: { id: string; label: string }[]
}) {
  return (
    <div className="segments" role="tablist">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          role="tab"
          aria-selected={value === option.id}
          className={value === option.id ? 'active' : ''}
          onClick={() => onChange(option.id)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function Mark({ className = 'mark' }: { className?: string }) {
  return <img className={className} src="/logo.png" alt="LAB CONTROL" />
}

export function FotoPerfil({ nombre }: { nombre: string }) {
  return <span className="avatar"><img src="/foto-perfil.jpg?v=2" alt={`Foto de ${nombre}`} /></span>
}
