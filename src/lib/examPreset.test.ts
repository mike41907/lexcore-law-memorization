import { describe, expect, it } from 'vitest'
import { buildExamPresetBundle, isDeletedArticleText, POLICE_SERGEANT_EXAM_PRESET, resolvePresetSummaries } from './examPreset'
import type { OfficialLawDetail, OfficialLawIndex, OfficialLawSummary } from './officialLaws'

const source = {
  provider: '法務部',
  systemName: '全國法規資料庫',
  datasetName: '中文法規_法律資料檔下載',
  datasetUrl: 'https://data.gov.tw/dataset/18289',
  apiUrl: 'https://law.moj.gov.tw/api/Ch/Law/JSON',
  licenseName: '政府資料開放授權條款第1版',
  licenseUrl: 'https://data.gov.tw/license',
  dataUpdatedAt: '2026-07-24',
  generatedAt: '2026-08-03T00:00:00.000Z',
}

function summary(name: string, index: number): OfficialLawSummary {
  return { code: `LAW${index}`, name, level: '法律', category: '測試', modifiedDate: '20260101', effectiveDate: '', status: 'current', abandonNote: '', url: `https://law.moj.gov.tw/${index}`, articleCount: 2, shard: '000.json' }
}

describe('police sergeant exam preset', () => {
  it('resolves the eight current laws in preset order', () => {
    const laws = [...POLICE_SERGEANT_EXAM_PRESET.laws].reverse().map((spec, index) => summary(spec.name, index))
    const index: OfficialLawIndex = { schemaVersion: 1, source, laws }
    expect(resolvePresetSummaries(index, POLICE_SERGEANT_EXAM_PRESET).map((law) => law.name)).toEqual(POLICE_SERGEANT_EXAM_PRESET.laws.map((law) => law.name))
  })

  it('builds categorized drafts and excludes deleted article placeholders', () => {
    const summaries = POLICE_SERGEANT_EXAM_PRESET.laws.map((spec, index) => summary(spec.name, index))
    const details: OfficialLawDetail[] = summaries.map((law) => ({ code: law.code, articles: [
      { number: '第 1 條', content: `${law.name}第一條。`, heading: '第一章' },
      { number: '第 2 條', content: '（刪除）', heading: '' },
    ] }))
    const index: OfficialLawIndex = { schemaVersion: 1, source, laws: summaries }
    const bundle = buildExamPresetBundle(index, POLICE_SERGEANT_EXAM_PRESET, summaries, details, '2026-08-03T01:02:03.000Z')
    expect(bundle.laws).toHaveLength(8)
    expect(bundle.laws.every((law) => law.drafts.length === 1 && law.deletedArticleCount === 1)).toBe(true)
    expect(bundle.laws[0].spec.subject).toBe('憲法')
    expect(bundle.laws[2].spec.subject).toBe('警察法規')
    expect(bundle.laws[0].drafts[0].source?.dataUpdatedAt).toBe('2026-07-24')
  })

  it('recognizes common deleted article markers and fails when a law is missing', () => {
    expect(isDeletedArticleText('（刪除）')).toBe(true)
    expect(isDeletedArticleText('( 刪除 )。')).toBe(true)
    expect(isDeletedArticleText('本條刪除後另有規定。')).toBe(false)
    const incomplete: OfficialLawIndex = { schemaVersion: 1, source, laws: [] }
    expect(() => resolvePresetSummaries(incomplete, POLICE_SERGEANT_EXAM_PRESET)).toThrow('中華民國憲法')
  })
})
