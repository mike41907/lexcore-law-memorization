import { describe, expect, it } from 'vitest'
import { calculateArticleStatus } from './mastery'

describe('calculateArticleStatus', () => {
  it('does not call one high score mastery', () => {
    expect(calculateArticleStatus({ score: 100, attempts: 1, dictationAverage: 100, fullDates: 1, fullStreak: 1, bestSevenDayScore: 0, keywordErrorCount: 0, structureErrorCount: 0, lastScore: 100 })).not.toBe('已精通')
  })

  it('requires cross-day and repeated evidence before mastery', () => {
    expect(calculateArticleStatus({ score: 97, attempts: 5, dictationAverage: 97, fullDates: 3, fullStreak: 3, bestSevenDayScore: 92, keywordErrorCount: 0, structureErrorCount: 0, lastScore: 97 })).toBe('已精通')
  })

  it('prioritizes high-risk state after a low score', () => {
    expect(calculateArticleStatus({ score: 80, attempts: 4, dictationAverage: 85, fullDates: 2, fullStreak: 0, bestSevenDayScore: 0, keywordErrorCount: 0, structureErrorCount: 0, lastScore: 75 })).toBe('需要重新學習')
  })
})
