import { describe, expect, it } from 'vitest'
import { calculateNextReview } from './scheduler'
import type { AnswerRecord, AppSettings, MasteryRecord } from '../types'

const settings: AppSettings = {
  id: 'settings', examDate: '2027-03-01', dailyStudyMinutes: 30, dailyNewArticles: 3, dailyReviewLimit: 15, includeMandatoryFirst: true, enableSurprise: false, surpriseQuestions: 3, fontScale: 1, soundEnabled: false, animationsEnabled: true,
  compare: { ignorePunctuation: true, ignoreWhitespace: true, ignoreLineBreaks: true, ignoreFullHalf: true, ignoreArabicChineseNumbers: false, strictLegalTerms: true, strictStructure: true },
  masteryWeights: { reading: .05, cloze: .15, ordering: .15, prompt: .2, dictation: .35, stability: .1 }, reviewIntervals: [.007, 1, 3, 7, 14, 30, 60, 90], highWeightKeywords: ['得', '應'], createdAt: '', updatedAt: '',
}
const mastery = { id: 'mastery-a', articleId: 'a', score: 0, status: '學習中', attempts: 0, reads: 0, clozeAverage: 0, orderingAverage: 0, promptAverage: 0, dictationAverage: 0, stabilityScore: 0, consecutiveCorrect: 0, crossDayPasses: 0, fullDictationDates: [], fullDictationStreak: 0, bestSevenDayScore: 0, keywordErrorCount: 0, structureErrorCount: 0, errorFrequency: 0, lastScore: 0, updatedAt: '' } as MasteryRecord

function answer(score: number): AnswerRecord { return { id: 'answer', articleId: 'a', lawId: 'l', mode: 'dictation', originalText: '甲', userAnswer: '甲', comparison: { expected: '甲', actual: '甲', normalizedExpected: '甲', normalizedActual: '甲', parts: [{ type: 'equal', expected: '甲', actual: '甲' }], errors: [], missing: [], extra: [], replacements: [], accuracy: score, keywordAccuracy: score, structureAccuracy: score, score, grade: score >= 95 ? 'A' : 'B', highWeightError: false, usedHints: 0 }, score, accuracy: score, keywordAccuracy: score, structureAccuracy: score, usedHints: 0, durationSeconds: 1, completed: true, createdAt: '2026-08-02T00:00:00.000Z' } }

describe('calculateNextReview', () => {
  it('extends the interval after a strong answer', () => {
    const result = calculateNextReview({ articleId: 'a', answer: answer(100), mastery, settings, now: new Date('2026-08-02T00:00:00.000Z') })
    expect(result.stage).toBe(1)
    expect(result.intervalDays).toBe(1)
  })

  it('returns to the short interval after an error', () => {
    const result = calculateNextReview({ articleId: 'a', answer: answer(70), mastery, settings, now: new Date('2026-08-02T00:00:00.000Z') })
    expect(result.stage).toBe(0)
    expect(result.intervalDays).toBe(.007)
    expect(result.lapses).toBe(1)
  })
})
