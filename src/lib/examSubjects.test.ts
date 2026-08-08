import { describe, expect, it } from 'vitest'
import type { LawCollection } from '../types'
import { classifyExamSubject, classifyLawType, migrateLawCollectionsToExamSubjects } from './examSubjects'

const law = (patch: Partial<LawCollection> = {}): LawCollection => ({ id: 'law-1', name: '警察勤務條例', shortName: '勤務條例', category: '警察勤務', importance: 3, examScope: true, notes: '', createdAt: '', updatedAt: '', ...patch })

describe('exam subjects', () => {
  it('keeps police duty separate from police law', () => {
    expect(classifyExamSubject(law())).toBe('police-duty')
    expect(classifyExamSubject(law({ name: '警察職權行使法', shortName: '警職法', category: '警察法規' }))).toBe('police-law')
    expect(classifyExamSubject(law({ name: '勤務相關研究筆記', shortName: '研究筆記', category: '其他' }))).toBe('unclassified')
  })

  it('classifies core laws and law types', () => {
    expect(classifyExamSubject(law({ name: '刑法', shortName: '刑法', category: '刑法', source: { type: 'moj-law', provider: '法務部全國法規資料庫', lawCode: 'C0000001', lawUrl: '', dataUpdatedAt: '', retrievedAt: '' } }))).toBe('criminal-law')
    expect(classifyLawType({ name: '警察勤務條例', source: undefined })).toBe('core')
    expect(classifyLawType({ name: '警察勤務條例施行細則', source: undefined })).toBe('implementing-rules')
  })

  it('migrates without changing identifiers or unrelated fields', () => {
    const original = law({ id: 'legacy-law', notes: '保留我的筆記' })
    const result = migrateLawCollectionsToExamSubjects([original])
    expect(result.laws[0]).toMatchObject({ id: 'legacy-law', notes: '保留我的筆記', examSubject: 'police-duty' })
    expect(result.changed).toHaveLength(1)
  })
})
