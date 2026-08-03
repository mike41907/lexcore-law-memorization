import type { AnswerRecord, AppSettings, ArticleStatus, LawArticle, MasteryRecord, ReviewSchedule } from '../types'
import { clamp, dateDiffInDays, todayKey } from './utils'

export function createInitialMastery(articleId: string, now = new Date()): MasteryRecord {
  return {
    id: `mastery-${articleId}`,
    articleId,
    score: 0,
    status: '未開始',
    attempts: 0,
    reads: 0,
    clozeAverage: 0,
    orderingAverage: 0,
    promptAverage: 0,
    dictationAverage: 0,
    stabilityScore: 0,
    consecutiveCorrect: 0,
    crossDayPasses: 0,
    fullDictationDates: [],
    fullDictationStreak: 0,
    bestSevenDayScore: 0,
    keywordErrorCount: 0,
    structureErrorCount: 0,
    errorFrequency: 0,
    lastScore: 0,
    updatedAt: now.toISOString(),
  }
}

export function updateMastery(
  previous: MasteryRecord | undefined,
  answer: AnswerRecord,
  settings: AppSettings,
  review: ReviewSchedule,
  now = new Date(),
): MasteryRecord {
  const current = previous ?? createInitialMastery(answer.articleId, now)
  const attempts = current.attempts + 1
  const averages = {
    clozeAverage: updateAverage(current.clozeAverage, answer.mode === 'cloze' || answer.mode === 'numbers' ? answer.score : undefined, attempts),
    orderingAverage: updateAverage(current.orderingAverage, answer.mode === 'ordering' ? answer.score : undefined, attempts),
    promptAverage: updateAverage(current.promptAverage, answer.mode === 'prompt' ? answer.score : undefined, attempts),
    dictationAverage: updateAverage(current.dictationAverage, answer.mode === 'dictation' || answer.mode === 'surprise' ? answer.score : undefined, attempts),
  }
  const dates = new Set(current.fullDictationDates)
  if ((answer.mode === 'dictation' || answer.mode === 'surprise') && answer.score >= 95 && answer.usedHints === 0 && !answer.comparison.highWeightError) dates.add(todayKey(now))
  const fullDates = Array.from(dates).sort()
  const fullDictationStreak = answer.mode === 'dictation' && answer.score >= 95 && answer.usedHints === 0 && !answer.comparison.highWeightError
    ? current.fullDictationStreak + 1
    : 0
  const crossDayPasses = Math.max(current.crossDayPasses, review.crossDayPasses)
  const stabilityScore = clamp((crossDayPasses / 3) * 100, 0, 100)
  const keywordErrorCount = current.keywordErrorCount + answer.comparison.errors.filter((error) => error.kind === 'keyword' || error.isHighWeight).length
  const structureErrorCount = current.structureErrorCount + answer.comparison.errors.filter((error) => error.kind === 'structure' || error.kind === 'order').length
  const errorFrequency = ((current.errorFrequency * current.attempts) + (answer.comparison.errors.length ? 1 : 0)) / attempts
  const weight = settings.masteryWeights
  const weighted = (
    averages.clozeAverage * weight.cloze +
    averages.orderingAverage * weight.ordering +
    averages.promptAverage * weight.prompt +
    averages.dictationAverage * weight.dictation +
    stabilityScore * weight.stability
  )
  const score = clamp(Math.round(weighted * 10) / 10, 0, 100)
  const status = calculateArticleStatus({
    score,
    attempts,
    dictationAverage: averages.dictationAverage,
    fullDates: fullDates.length,
    fullStreak: fullDictationStreak,
    bestSevenDayScore: current.bestSevenDayScore,
    keywordErrorCount,
    structureErrorCount,
    lastScore: answer.score,
  })
  return {
    ...current,
    ...averages,
    score,
    status,
    attempts,
    consecutiveCorrect: review.consecutiveCorrect,
    crossDayPasses,
    fullDictationDates: fullDates,
    fullDictationStreak,
    stabilityScore,
    keywordErrorCount,
    structureErrorCount,
    errorFrequency: Math.round(errorFrequency * 1000) / 1000,
    lastScore: answer.score,
    lastReviewAt: now.toISOString(),
    updatedAt: now.toISOString(),
  }
}

export function calculateArticleStatus(input: {
  score: number
  attempts: number
  dictationAverage: number
  fullDates: number
  fullStreak: number
  bestSevenDayScore: number
  keywordErrorCount: number
  structureErrorCount: number
  lastScore: number
}): ArticleStatus {
  if (input.lastScore < 80 && input.attempts > 0) return '需要重新學習'
  if (input.lastScore < 90 && input.attempts > 0) return '高風險'
  if (input.score >= 95 && input.dictationAverage >= 95 && input.fullDates >= 3 && input.fullStreak >= 3 && input.bestSevenDayScore >= 90 && input.keywordErrorCount === 0 && input.structureErrorCount === 0) return '已精通'
  if (input.score >= 90 && input.dictationAverage >= 85) return '已熟練'
  if (input.score >= 75) return '接近熟練'
  if (input.score >= 45) return '尚未穩定'
  if (input.attempts >= 1) return '學習中'
  return '未開始'
}

export function applyReadToMastery(previous: MasteryRecord | undefined, articleId: string, now = new Date()): MasteryRecord {
  const current = previous ?? createInitialMastery(articleId, now)
  return { ...current, reads: current.reads + 1, status: current.status === '未開始' ? '初次接觸' : current.status, updatedAt: now.toISOString() }
}

export function getArticleStatus(mastery: MasteryRecord | undefined): ArticleStatus {
  return mastery?.status ?? '未開始'
}

export function estimateExamCompletion(articles: LawArticle[], mastery: MasteryRecord[], dailyMinutes: number, remainingDays: number): {
  currentRate: number
  forecastRate: number
  recommendedNew: number
  recommendedReview: number
  behind: boolean
} {
  const total = articles.length
  if (!total) return { currentRate: 0, forecastRate: 0, recommendedNew: 0, recommendedReview: 0, behind: false }
  const learned = mastery.filter((item) => item.attempts > 0).length
  const mastered = mastery.filter((item) => item.status === '已精通' || item.status === '已熟練').length
  const currentRate = (mastered / total) * 100
  const activeDays = Math.max(1, mastery.filter((item) => item.attempts > 0).length)
  const averageNewPerDay = learned / activeDays
  const estimatedCapacity = Math.max(0, Math.floor(dailyMinutes / 8))
  const forecastLearned = Math.min(total, learned + Math.max(averageNewPerDay, estimatedCapacity) * Math.max(remainingDays, 0))
  const forecastRate = clamp((forecastLearned / total) * 100, 0, 100)
  const targetDaily = Math.ceil(Math.max(0, total - mastered) / Math.max(remainingDays, 1))
  const recommendedNew = Math.max(1, Math.min(20, targetDaily))
  const recommendedReview = Math.max(3, Math.min(50, Math.ceil(recommendedNew * 2.5)))
  return { currentRate, forecastRate, recommendedNew, recommendedReview, behind: forecastRate < 90 }
}

function updateAverage(previous: number, value: number | undefined, attempts: number): number {
  if (value === undefined) return previous
  const previousCount = Math.max(0, attempts - 1)
  return Math.round((((previous * previousCount) + value) / attempts) * 10) / 10
}

export function hasSevenDayPass(answer: AnswerRecord, previousReview?: ReviewSchedule): boolean {
  return Boolean(previousReview && previousReview.intervalDays >= 7 && answer.score >= 90)
}

export function daysSinceLastReview(master?: MasteryRecord): number | undefined {
  if (!master?.lastReviewAt) return undefined
  return dateDiffInDays(todayKey(new Date(master.lastReviewAt)))
}
