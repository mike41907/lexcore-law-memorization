import type { AppSettings, DailyTask, LawArticle, MasteryRecord, ReviewSchedule, TaskType } from '../types'
import { isReviewDue } from './scheduler'
import { makeId, nowIso, todayKey } from './utils'
import { compareExamFrequency, examFrequencyScore } from './criminalProcedureFrequency'
import { compareArticleNumbers } from './lawSystem'

export function generateDailyTasks(
  articles: LawArticle[],
  reviews: ReviewSchedule[],
  mastery: MasteryRecord[],
  settings: AppSettings,
  date = todayKey(),
): DailyTask[] {
  const active = articles.filter((article) => !article.deletedAt && article.includeDaily)
  const reviewMap = new Map(reviews.map((review) => [review.articleId, review]))
  const masteryMap = new Map(mastery.map((item) => [item.articleId, item]))
  const result: DailyTask[] = []
  const used = new Set<string>()
  const add = (article: LawArticle, type: TaskType, estimatedMinutes: number): void => {
    if (used.has(article.id)) return
    used.add(article.id)
    result.push({ id: makeId('task'), date, articleId: article.id, type, estimatedMinutes, completed: false, createdAt: nowIso() })
  }

  const due = active.filter((article) => isReviewDue(reviewMap.get(article.id))).sort((a, b) => compareArticlePriority(a, b, masteryMap))
  due.slice(0, settings.dailyReviewLimit).forEach((article) => add(article, masteryMap.get(article.id)?.status === '高風險' ? 'high-risk' : 'due', 6))

  const yesterdayErrors = active.filter((article) => {
    const record = masteryMap.get(article.id)
    return Boolean(record && record.errorFrequency > 0.25)
  })
  yesterdayErrors.sort((a, b) => compareArticlePriority(a, b, masteryMap)).slice(0, 3).forEach((article) => add(article, 'yesterday-error', 7))

  const newArticles = active
    .filter((article) => !masteryMap.get(article.id)?.attempts)
    .sort((a, b) => compareArticlePriority(a, b, masteryMap))
  newArticles.slice(0, settings.dailyNewArticles).forEach((article) => add(article, 'new', 8))

  if (settings.enableSurprise) {
    active.filter((article) => (masteryMap.get(article.id)?.score ?? 0) >= 75).slice(0, settings.surpriseQuestions).forEach((article) => add(article, 'surprise', 5))
  }
  return result
}

export function taskTypeLabel(type: TaskType): string {
  const labels: Record<TaskType, string> = {
    new: '新法條',
    due: '到期複習',
    'yesterday-error': '昨日錯題',
    'seven-day': '七日複習',
    'high-risk': '高風險',
    surprise: '突擊抽考',
    'mastery-check': '精通抽查',
  }
  return labels[type]
}

export function compareTrainingPriority(left: LawArticle, right: LawArticle): number {
  return examFrequencyScore(right) - examFrequencyScore(left)
    || compareExamFrequency(left, right)
    || Number(right.mustMemorize) - Number(left.mustMemorize)
    || right.importance - left.importance
    || compareArticleNumbers(left, right)
}

function compareArticlePriority(left: LawArticle, right: LawArticle, mastery: Map<string, MasteryRecord>): number {
  return priorityOf(right, mastery.get(right.id)) - priorityOf(left, mastery.get(left.id))
    || compareTrainingPriority(left, right)
}

function priorityOf(article: LawArticle, record: MasteryRecord | undefined): number {
  return examFrequencyScore(article)
    + (article.mustMemorize ? 50 : 0)
    + article.importance * 5
    + (record?.status === '高風險' ? 30 : 0)
    + (record?.status === '需要重新學習' ? 40 : 0)
}
