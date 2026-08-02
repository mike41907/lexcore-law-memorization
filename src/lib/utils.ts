import type { AppSettings, ISODate } from '../types'

export const nowIso = (): ISODate => new Date().toISOString()

export function makeId(prefix: string): string {
  const uuid = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`
  return `${prefix}-${uuid}`
}

export function todayKey(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseLocalDate(value: string): Date {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, (month || 1) - 1, day || 1)
}

export function formatDateTW(value?: string | Date): string {
  if (!value) return '尚無紀錄'
  const date = value instanceof Date ? value : new Date(value.includes('T') ? value : `${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return '日期無效'
  return `${date.getFullYear()}年${String(date.getMonth() + 1).padStart(2, '0')}月${String(date.getDate()).padStart(2, '0')}日`
}

export function formatDateTimeTW(value?: string): string {
  if (!value) return '尚無紀錄'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '日期無效'
  return `${formatDateTW(date)} ${String(date.getHours()).padStart(2, '0')}時${String(date.getMinutes()).padStart(2, '0')}分`
}

export function daysUntil(dateValue: string, from = new Date()): number {
  const target = parseLocalDate(dateValue)
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  return Math.ceil((target.getTime() - start.getTime()) / 86_400_000)
}

export function formatRelativeReview(value?: string): string {
  if (!value) return '尚未安排'
  const date = new Date(value)
  const diff = date.getTime() - Date.now()
  if (diff <= 0) return '現在到期'
  const minutes = Math.ceil(diff / 60_000)
  if (minutes < 60) return `${minutes} 分鐘後`
  const hours = Math.ceil(minutes / 60)
  if (hours < 24) return `${hours} 小時後`
  return `${Math.ceil(hours / 24)} 天後`
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function average(values: number[], fallback = 0): number {
  if (!values.length) return fallback
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function percent(value: number): string {
  return `${Math.round(value)}%`
}

export function gradeForScore(score: number): 'S' | 'A' | 'B' | 'C' | 'D' | 'E' {
  if (score >= 100) return 'S'
  if (score >= 95) return 'A'
  if (score >= 90) return 'B'
  if (score >= 80) return 'C'
  if (score >= 70) return 'D'
  return 'E'
}

export function normalizeSettings(settings: AppSettings): AppSettings {
  const weights = settings.masteryWeights
  const total = Object.values(weights).reduce((sum, value) => sum + value, 0)
  const normalized = total > 0
    ? Object.fromEntries(Object.entries(weights).map(([key, value]) => [key, value / total])) as unknown as AppSettings['masteryWeights']
    : DEFAULT_WEIGHT_COPY()
  return {
    ...settings,
    masteryWeights: normalized,
    reviewIntervals: settings.reviewIntervals.length ? settings.reviewIntervals : [0.007, 1, 3, 7, 14, 30, 60, 90],
    highWeightKeywords: Array.from(new Set(settings.highWeightKeywords.map((item) => item.trim()).filter(Boolean))),
  }
}

function DEFAULT_WEIGHT_COPY(): AppSettings['masteryWeights'] {
  return { reading: 0.05, cloze: 0.15, ordering: 0.15, prompt: 0.2, dictation: 0.35, stability: 0.1 }
}

export function truncate(value: string, length = 80): string {
  return value.length > length ? `${value.slice(0, length)}…` : value
}

export function isDue(value?: string, now = new Date()): boolean {
  return Boolean(value && new Date(value).getTime() <= now.getTime())
}

export function dateDiffInDays(start: string, end = todayKey()): number {
  return Math.round((parseLocalDate(end).getTime() - parseLocalDate(start).getTime()) / 86_400_000)
}
