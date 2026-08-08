import type { AppSettings, DailyTask, KnowledgeMastery, KnowledgePoint, KnowledgeReview, LawArticle, MasteryRecord, ReviewSchedule, TaskType } from '../types'
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

/** Generate today's queue at the knowledge-point level. Article tasks remain
 * supported for old backups, but new queues prefer the smallest examinable unit. */
export function generateKnowledgeDailyTasks(
  points: KnowledgePoint[],
  reviews: KnowledgeReview[],
  mastery: KnowledgeMastery[],
  articles: LawArticle[],
  settings: AppSettings,
  date = todayKey(),
): DailyTask[] {
  const activeArticles = new Map(articles.filter((article) => !article.deletedAt && article.includeDaily).map((article) => [article.id, article]))
  const reviewMap = new Map(reviews.map((review) => [review.knowledgePointId, review]))
  const masteryMap = new Map(mastery.map((item) => [item.knowledgePointId, item]))
  const candidates = points.filter((point) => !point.deletedAt && activeArticles.has(point.articleId))
  const used = new Set<string>()
  const result: DailyTask[] = []
  const priority = (point: KnowledgePoint): number => {
    const article = activeArticles.get(point.articleId)
    const pointMastery = masteryMap.get(point.id)
    const due = reviewMap.get(point.id)?.nextReviewAt && new Date(reviewMap.get(point.id)!.nextReviewAt).getTime() <= Date.now()
    return point.importance * 20 + point.difficulty * 8 + (article?.mustMemorize ? 30 : 0) + (due ? 60 : 0) + (pointMastery?.status === '高風險' ? 50 : 0) + (pointMastery?.attempts ? 0 : 25)
  }
  const add = (point: KnowledgePoint, type: TaskType, minutes: number): void => {
    if (used.has(point.id)) return
    used.add(point.id)
    result.push({ id: makeId('task'), date, articleId: point.articleId, knowledgePointId: point.id, targetType: 'knowledge-point', type, estimatedMinutes: minutes, completed: false, createdAt: nowIso() })
  }
  const due = candidates.filter((point) => {
    const review = reviewMap.get(point.id)
    return Boolean(review && new Date(review.nextReviewAt).getTime() <= Date.now())
  }).sort((left, right) => priority(right) - priority(left))
  due.slice(0, settings.dailyReviewLimit).forEach((point) => add(point, masteryMap.get(point.id)?.status === '高風險' ? 'high-risk' : 'due', 5))
  const highRisk = candidates.filter((point) => (masteryMap.get(point.id)?.errorFrequency ?? 0) > 0.25).sort((left, right) => priority(right) - priority(left))
  highRisk.slice(0, 5).forEach((point) => add(point, 'yesterday-error', 6))
  const fresh = candidates.filter((point) => !(masteryMap.get(point.id)?.attempts ?? 0)).sort((left, right) => priority(right) - priority(left))
  fresh.slice(0, Math.max(settings.dailyNewArticles * 2, 1)).forEach((point) => add(point, 'new', 5))
  if (settings.enableSurprise) candidates.filter((point) => (masteryMap.get(point.id)?.score ?? 0) >= 75).sort((left, right) => priority(right) - priority(left)).slice(0, settings.surpriseQuestions).forEach((point) => add(point, 'surprise', 4))
  return result
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
