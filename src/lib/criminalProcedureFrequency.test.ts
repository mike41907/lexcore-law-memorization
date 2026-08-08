import { describe, expect, it } from 'vitest'
import type { LawArticle, LawCollection } from '../types'
import {
  CRIMINAL_PROCEDURE_FREQUENCY_TOPICS,
  applyCriminalProcedureFrequency,
  buildCriminalProcedureArticleFrequency,
  compareExamFrequency,
  examFrequencyTier,
} from './criminalProcedureFrequency'

describe('criminal procedure exam frequency', () => {
  it('contains the complete descending 120-topic source table', () => {
    expect(CRIMINAL_PROCEDURE_FREQUENCY_TOPICS).toHaveLength(120)
    expect(CRIMINAL_PROCEDURE_FREQUENCY_TOPICS.map((topic) => topic.rank)).toEqual(Array.from({ length: 120 }, (_, index) => index + 1))
    expect(CRIMINAL_PROCEDURE_FREQUENCY_TOPICS.every((topic, index, topics) => index === 0 || topics[index - 1].count >= topic.count)).toBe(true)
    expect(examFrequencyTier(15)).toBe('S')
    expect(examFrequencyTier(16)).toBe('A')
    expect(examFrequencyTier(41)).toBe('B')
    expect(examFrequencyTier(76)).toBe('C')
  })

  it('aggregates overlapping topics onto the mapped article', () => {
    const map = buildCriminalProcedureArticleFrequency()
    expect(map.get('130')).toMatchObject({ bestRank: 1, totalCount: 49, tier: 'S' })
    expect(map.get('245')).toMatchObject({ bestRank: 14, totalCount: 66, tier: 'S' })
    expect(map.get('158-4')?.topics.map((topic) => topic.rank)).toEqual([21, 57, 85, 95, 99, 109])
  })

  it('raises only Criminal Procedure Code priorities and sorts the highest frequency first', () => {
    const criminalLaw = law('criminal', '刑事訴訟法', 'C0010001')
    const otherLaw = law('other', '刑法', 'C0000001')
    const input = [article('a130', criminalLaw.id, '130'), article('a159', criminalLaw.id, '159-5'), article('other130', otherLaw.id, '130')]
    const result = applyCriminalProcedureFrequency([criminalLaw, otherLaw], input)
    const top = result.articles.find((item) => item.id === 'a130')
    expect(top).toMatchObject({ importance: 5, mustMemorize: true, includeDaily: true, isBoss: true })
    expect(result.articles.find((item) => item.id === 'other130')?.examFrequency).toBeUndefined()
    expect([...result.articles.filter((item) => item.lawId === criminalLaw.id)].sort(compareExamFrequency).map((item) => item.articleNumber)).toEqual(['130', '159-5'])
  })
})

function law(id: string, name: string, lawCode: string): LawCollection {
  return { id, name, shortName: name, category: '測試', importance: 3, examScope: true, notes: '', source: { type: 'moj-law', provider: '法務部全國法規資料庫', lawCode, lawUrl: '', dataUpdatedAt: '', retrievedAt: '' }, createdAt: '', updatedAt: '' }
}

function article(id: string, lawId: string, articleNumber: string): LawArticle {
  return { id, lawId, articleNumber, title: '', text: '測試條文', notes: '', importance: 1, mustMemorize: false, includeDaily: false, tags: [], isBoss: false, createdAt: '', updatedAt: '' }
}
