import type { ReactNode } from 'react'
import type { ArticleStatus, TrainingMode } from '../types'
import { percent } from '../lib/utils'

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }): JSX.Element {
  return <div className="page-header"><div><p className="eyebrow">{eyebrow ?? 'LEXCORE / 本機訓練系統'}</p><h1>{title}</h1>{description && <p className="page-description">{description}</p>}</div>{actions && <div className="page-actions">{actions}</div>}</div>
}

export function Button({ children, variant = 'primary', type = 'button', className = '', disabled = false, onClick }: { children: ReactNode; variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold'; type?: 'button' | 'submit' | 'reset'; className?: string; disabled?: boolean; onClick?: () => void }): JSX.Element {
  return <button type={type} className={`button button-${variant} ${className}`} disabled={disabled} onClick={onClick}>{children}</button>
}

export function ProgressBar({ value, tone = 'gold', label, showValue = true }: { value: number; tone?: 'gold' | 'blue' | 'green' | 'red'; label?: string; showValue?: boolean }): JSX.Element {
  return <div className="progress-wrap">{(label || showValue) && <div className="progress-label"><span>{label}</span>{showValue && <strong>{percent(value)}</strong>}</div>}<div className={`progress-track progress-${tone}`}><span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div></div>
}

export function StatusBadge({ status }: { status: ArticleStatus }): JSX.Element {
  const className = status.replace(/[\s]/g, '')
  return <span className={`status-badge status-${className}`}>{status}</span>
}

export function ModeBadge({ mode }: { mode: TrainingMode }): JSX.Element {
  const labels: Record<TrainingMode, string> = { reading: '閱讀', numbers: '數字陷阱', cloze: '填空', ordering: '排序', prompt: '提示默寫', dictation: '完整默寫', surprise: '突擊抽考' }
  return <span className="mode-badge">{labels[mode]}</span>
}

export function EmptyState({ icon = '◇', title, description, action }: { icon?: string; title: string; description: string; action?: ReactNode }): JSX.Element {
  return <div className="empty-state"><div className="empty-icon">{icon}</div><h3>{title}</h3><p>{description}</p>{action}</div>
}

export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warning' | 'success' }): JSX.Element {
  return <div className={`notice notice-${tone}`}><span>{tone === 'warning' ? '!' : tone === 'success' ? '✓' : 'i'}</span><div>{children}</div></div>
}

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }): JSX.Element {
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><div className="modal-card" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}><div className="modal-header"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="關閉">×</button></div>{children}</div></div>
}

export function Stars({ value }: { value: number }): JSX.Element {
  return <span className="stars" aria-label={`${value} / 5 重要程度`}>{[1, 2, 3, 4, 5].map((star) => <span key={star} className={star <= value ? 'filled' : ''}>◆</span>)}</span>
}

export function formatSeconds(seconds: number): string {
  if (seconds < 60) return `${seconds} 秒`
  return `${Math.floor(seconds / 60)} 分 ${seconds % 60} 秒`
}
