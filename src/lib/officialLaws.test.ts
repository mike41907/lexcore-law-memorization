import { describe, expect, it } from 'vitest'
import { createOfficialImportDrafts, normalizeOfficialArticleNumber, parseOfficialLawIndex, searchOfficialLaws, type OfficialLawDataSource, type OfficialLawDetail, type OfficialLawSummary } from './officialLaws'

const source: OfficialLawDataSource = {
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

const laws: OfficialLawSummary[] = [
  { code: 'C0000001', name: '中華民國刑法', level: '法律', category: '法務部', modifiedDate: '20260101', effectiveDate: '', status: 'current', abandonNote: '', url: 'https://law.moj.gov.tw/a', articleCount: 2, shard: '000.json' },
  { code: 'D0000001', name: '刑法施行法舊版', level: '法律', category: '廢止法規', modifiedDate: '19900101', effectiveDate: '', status: 'repealed', abandonNote: '廢', url: 'https://law.moj.gov.tw/b', articleCount: 1, shard: '000.json' },
]

describe('official law data', () => {
  it('validates an index and searches current laws by default', () => {
    const index = parseOfficialLawIndex({ schemaVersion: 1, source, laws })
    expect(index.laws).toHaveLength(2)
    expect(searchOfficialLaws(index.laws, '刑法').map((law) => law.code)).toEqual(['C0000001'])
    expect(searchOfficialLaws(index.laws, '刑法', true)).toHaveLength(2)
  })

  it('normalizes official article numbers and keeps selected source text', () => {
    const detail: OfficialLawDetail = {
      code: 'C0000001',
      articles: [
        { number: '第 1 條', content: '第一條原文。', heading: '第一章 總則' },
        { number: '第 1-1 條', content: '增訂條文。', heading: '第一章 總則' },
      ],
    }
    const drafts = createOfficialImportDrafts(source, laws[0], detail, ['1-1'], '2026-08-03T01:02:03.000Z')
    expect(normalizeOfficialArticleNumber('第 １-１ 條')).toBe('1-1')
    expect(drafts).toHaveLength(1)
    expect(drafts[0]).toMatchObject({ articleNumber: '1-1', text: '增訂條文。', title: '第一章 總則' })
    expect(drafts[0].source).toMatchObject({ provider: '法務部全國法規資料庫', lawCode: 'C0000001', dataUpdatedAt: '2026-07-24' })
  })

  it('rejects malformed indexes', () => {
    expect(() => parseOfficialLawIndex({ schemaVersion: 1, source, laws: [{ name: '缺少欄位' }] })).toThrow('狀態不正確')
  })
})
