import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, type LawArticle } from '../types'
import { generateDailyTasks } from './tasks'

describe('daily task priority', () => {
  it('places high-frequency articles before ordinary new articles and respects includeDaily', () => {
    const ordinary = article('ordinary', '1')
    const excluded = { ...article('excluded', '2'), importance: 5 as const, mustMemorize: true, includeDaily: false }
    const highFrequency = {
      ...article('high', '130'),
      examFrequency: { sourceId: 'criminal-procedure-120' as const, bestRank: 1, totalCount: 49, tier: 'S' as const, topics: [] },
    }
    const tasks = generateDailyTasks([ordinary, excluded, highFrequency], [], [], { ...DEFAULT_SETTINGS, dailyNewArticles: 3 }, '2026-08-08')
    expect(tasks.map((task) => task.articleId)).toEqual(['high', 'ordinary'])
  })
})

function article(id: string, articleNumber: string): LawArticle {
  return { id, lawId: 'law', articleNumber, title: '', text: '測試', notes: '', importance: 3, mustMemorize: false, includeDaily: true, tags: [], isBoss: false, createdAt: '', updatedAt: '' }
}
