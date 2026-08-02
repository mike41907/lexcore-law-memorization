import type { AppSettings, AnswerRecord, MasteryRecord, ReviewSchedule } from '../types'
import { clamp, makeId, nowIso } from './utils'

export interface ScheduleInput {
  articleId: string
  previous?: ReviewSchedule
  answer: AnswerRecord
  mastery: MasteryRecord
  settings: AppSettings
  now?: Date
}

export function calculateNextReview(input: ScheduleInput): ReviewSchedule {
  const now = input.now ?? new Date()
  const score = input.answer.score
  const wasStrong = score >= 95 && input.answer.usedHints === 0 && !input.answer.comparison.highWeightError
  const wasPass = score >= 90 && !input.answer.comparison.highWeightError
  const previous = input.previous
  const currentStage = previous?.stage ?? 0
  let stage = currentStage
  let intervalDays = input.settings.reviewIntervals[currentStage] ?? 0.007
  let consecutiveCorrect = previous?.consecutiveCorrect ?? 0
  let lapses = previous?.lapses ?? 0
  let crossDayPasses = previous?.crossDayPasses ?? 0

  if (wasStrong) {
    stage = Math.min(currentStage + 1, input.settings.reviewIntervals.length - 1)
    intervalDays = input.settings.reviewIntervals[stage] ?? 90
    consecutiveCorrect += 1
    if (previous?.lastReviewedAt && differentCalendarDay(previous.lastReviewedAt, now)) crossDayPasses += 1
  } else if (wasPass) {
    intervalDays = input.settings.reviewIntervals[currentStage] ?? 1
    consecutiveCorrect = Math.max(1, consecutiveCorrect)
    if (previous?.lastReviewedAt && differentCalendarDay(previous.lastReviewedAt, now)) crossDayPasses += 1
  } else {
    stage = 0
    intervalDays = 0.007
    consecutiveCorrect = 0
    lapses += 1
  }

  if (input.answer.usedHints > 0) intervalDays = Math.min(intervalDays, input.settings.reviewIntervals[Math.min(stage, 2)] ?? 3)
  if (score < 80) intervalDays = 0.007
  const nextReview = new Date(now.getTime() + intervalDays * 86_400_000)
  return {
    id: previous?.id ?? makeId('review'),
    articleId: input.articleId,
    stage,
    intervalDays: round(intervalDays),
    nextReviewAt: nextReview.toISOString(),
    lastReviewedAt: now.toISOString(),
    lastScore: score,
    consecutiveCorrect,
    lapses,
    crossDayPasses,
  }
}

export function isReviewDue(review?: ReviewSchedule, now = new Date()): boolean {
  return Boolean(review && new Date(review.nextReviewAt).getTime() <= now.getTime())
}

export function initialReview(articleId: string, settings: AppSettings, now = new Date()): ReviewSchedule {
  const intervalDays = settings.reviewIntervals[0] ?? 0.007
  return {
    id: makeId('review'),
    articleId,
    stage: 0,
    intervalDays,
    nextReviewAt: new Date(now.getTime() + intervalDays * 86_400_000).toISOString(),
    consecutiveCorrect: 0,
    lapses: 0,
    crossDayPasses: 0,
  }
}

function differentCalendarDay(first: string, second: Date): boolean {
  const a = new Date(first)
  return a.toDateString() !== second.toDateString()
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000
}

export function reviewLabel(review?: ReviewSchedule): string {
  if (!review) return '尚未安排'
  if (isReviewDue(review)) return '現在到期'
  if (review.intervalDays < 1) return '10 分鐘後'
  return `${Math.round(review.intervalDays)} 天後`
}

export function scoreToQuality(score: number): number {
  return clamp(Math.round(score / 20), 0, 5)
}
