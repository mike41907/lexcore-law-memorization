import type { BackupData } from '../types'
import type { DatabaseSnapshot } from './db'

export const BACKUP_VERSION = '0.1.0'

export function createBackup(snapshot: DatabaseSnapshot, exportedAt = new Date().toISOString()): BackupData {
  const settings = snapshot.settings[0]
  const progress = snapshot.progress[0]
  if (!settings || !progress) throw new Error('目前本機資料尚未初始化完成，無法建立備份。')
  return {
    format: 'lexcore-backup',
    version: BACKUP_VERSION,
    exportedAt,
    settings,
    laws: snapshot.laws,
    articles: snapshot.articles,
    sections: snapshot.sections,
    sessions: snapshot.sessions,
    answers: snapshot.answers,
    errors: snapshot.errors,
    reviews: snapshot.reviews,
    mastery: snapshot.mastery,
    tasks: snapshot.tasks,
    achievements: snapshot.achievements,
    confusions: snapshot.confusions,
    progress,
    knowledgePoints: snapshot.knowledgePoints,
    knowledgeQuestions: snapshot.knowledgeQuestions,
    knowledgeMastery: snapshot.knowledgeMastery,
    knowledgeReviews: snapshot.knowledgeReviews,
  }
}

export function parseBackup(raw: string): BackupData {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('備份檔不是有效的 JSON，請選擇由本系統匯出的檔案。')
  }
  if (!isRecord(parsed) || parsed.format !== 'lexcore-backup') throw new Error('這不是 LexCore 備份檔，未執行任何還原。')
  const requiredArrays = ['laws', 'articles', 'sections', 'sessions', 'answers', 'errors', 'reviews', 'mastery', 'tasks', 'achievements', 'confusions']
  for (const key of requiredArrays) {
    if (!Array.isArray(parsed[key])) throw new Error(`備份檔缺少有效的 ${key} 資料。`)
  }
  if (!isRecord(parsed.settings) || !isRecord(parsed.progress)) throw new Error('備份檔缺少設定或遊戲進度資料。')
  return {
    ...(parsed as unknown as BackupData),
    knowledgePoints: Array.isArray(parsed.knowledgePoints) ? parsed.knowledgePoints as BackupData['knowledgePoints'] : [],
    knowledgeQuestions: Array.isArray(parsed.knowledgeQuestions) ? parsed.knowledgeQuestions as BackupData['knowledgeQuestions'] : [],
    knowledgeMastery: Array.isArray(parsed.knowledgeMastery) ? parsed.knowledgeMastery as BackupData['knowledgeMastery'] : [],
    knowledgeReviews: Array.isArray(parsed.knowledgeReviews) ? parsed.knowledgeReviews as BackupData['knowledgeReviews'] : [],
  }
}

export function backupSummary(backup: BackupData): { exportedAt: string; laws: number; articles: number; answers: number } {
  return { exportedAt: backup.exportedAt, laws: backup.laws.length, articles: backup.articles.length, answers: backup.answers.length }
}

export function downloadBackup(backup: BackupData): void {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `lexcore-backup-${backup.exportedAt.slice(0, 10)}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
