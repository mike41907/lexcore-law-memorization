import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, type LawArticle } from '../types'
import { buildKnowledgePoints, generateKnowledgeQuestions, updateKnowledgeMastery } from './knowledgePointEngine'
import { generateKnowledgeDailyTasks } from './tasks'

describe('knowledge point engine', () => {
  it('extracts rule-based points from exact legal text and creates at least two questions', () => {
    const article = sampleArticle('article-1', '本條應於三日內向法院提出，不得逾越五年，違者處以罰金。但書有特別規定者，不在此限。')
    const points = buildKnowledgePoints(article)
    expect(points.length).toBeGreaterThan(2)
    expect(points.some((point) => point.type === 'MUST')).toBe(true)
    expect(points.some((point) => point.type === 'PROHIBITED')).toBe(true)
    expect(points.some((point) => point.type === 'TIME_LIMIT')).toBe(true)
    expect(points.every((point) => article.text.includes(point.originalSentence))).toBe(true)
    expect(points.every((point) => {
      const questions = generateKnowledgeQuestions(point, article, [article])
      return questions.length >= 2 && questions.length <= 20 && questions.every((question) => question.knowledgePointId === point.id)
    })).toBe(true)
  })

  it('supports per-point mastery and point-level daily tasks', () => {
    const articles = Array.from({ length: 20 }, (_, index) => sampleArticle(`article-${index}`, `第${index + 1}條應於三日內完成，不得逾期。`))
    const points = articles.flatMap((article) => buildKnowledgePoints(article))
    const mastery = points.map((point) => updateKnowledgeMastery(undefined, point, point.type === 'TIME_LIMIT' ? 50 : 90))
    const reviews = points.map((point) => ({ id: `review-${point.id}`, knowledgePointId: point.id, articleId: point.articleId, stage: 0, intervalDays: 0, nextReviewAt: new Date(0).toISOString(), consecutiveCorrect: 0, lapses: 0, crossDayPasses: 0 }))
    const tasks = generateKnowledgeDailyTasks(points, reviews, mastery, articles, { ...DEFAULT_SETTINGS, dailyReviewLimit: 10 }, '2026-08-08')
    expect(points.length).toBeGreaterThanOrEqual(20)
    expect(tasks.length).toBeGreaterThan(0)
    expect(tasks.every((task) => task.targetType === 'knowledge-point' && task.knowledgePointId)).toBe(true)
  })
})

function sampleArticle(id: string, text: string): LawArticle {
  return { id, lawId: 'law', articleNumber: id, title: '', text, notes: '', importance: 4, mustMemorize: true, includeDaily: true, tags: [], isBoss: false, createdAt: '', updatedAt: '' }
}
