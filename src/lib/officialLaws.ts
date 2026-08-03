import type { ImportArticleDraft, OfficialImportSource } from '../types'
import { isRecord, normalizeArticleNumber } from './importer'

export interface OfficialLawDataSource {
  provider: string
  systemName: string
  datasetName: string
  datasetUrl: string
  apiUrl: string
  licenseName: string
  licenseUrl: string
  dataUpdatedAt: string
  generatedAt: string
}

export interface OfficialLawSummary {
  code: string
  name: string
  level: string
  category: string
  modifiedDate: string
  effectiveDate: string
  status: 'current' | 'repealed'
  abandonNote: string
  url: string
  articleCount: number
  shard: string
}

export interface OfficialLawArticle {
  number: string
  content: string
  heading: string
}

export interface OfficialLawDetail {
  code: string
  articles: OfficialLawArticle[]
}

export interface OfficialLawIndex {
  schemaVersion: 1
  source: OfficialLawDataSource
  laws: OfficialLawSummary[]
}

interface OfficialLawShard {
  schemaVersion: 1
  laws: OfficialLawDetail[]
}

const INDEX_PATH = 'official/moj-law-index.json'

export async function fetchOfficialLawIndex(): Promise<OfficialLawIndex> {
  const payload = await fetchOfficialJson(INDEX_PATH)
  return parseOfficialLawIndex(payload)
}

export async function fetchOfficialLawDetail(summary: OfficialLawSummary): Promise<OfficialLawDetail> {
  const payload = await fetchOfficialJson(`official/shards/${summary.shard}`)
  const shard = parseOfficialLawShard(payload)
  const detail = shard.laws.find((law) => law.code === summary.code)
  if (!detail) throw new Error('官方法規分片中找不到這部法規，請重新整理資料後再試。')
  return detail
}

export function parseOfficialLawIndex(value: unknown): OfficialLawIndex {
  if (!isRecord(value) || value.schemaVersion !== 1 || !isRecord(value.source) || !Array.isArray(value.laws)) {
    throw new Error('官方法規索引格式不正確。')
  }
  const source = parseSource(value.source)
  const laws = value.laws.map((law, index) => parseLawSummary(law, index))
  return { schemaVersion: 1, source, laws }
}

export function searchOfficialLaws(laws: OfficialLawSummary[], query: string, includeRepealed = false, limit = 50): OfficialLawSummary[] {
  const needle = normalizeSearch(query)
  if (!needle) return []
  return laws
    .filter((law) => includeRepealed || law.status === 'current')
    .map((law) => ({ law, score: lawSearchScore(law, needle) }))
    .filter((entry) => entry.score < 99)
    .sort((left, right) => left.score - right.score
      || Number(left.law.status === 'repealed') - Number(right.law.status === 'repealed')
      || left.law.name.localeCompare(right.law.name, 'zh-Hant'))
    .slice(0, Math.max(0, limit))
    .map((entry) => entry.law)
}

export function normalizeOfficialArticleNumber(value: string): string {
  return normalizeArticleNumber(value.replace(/^\s*第\s*/, '').replace(/\s*條\s*$/, '')) || '未編號'
}

export function createOfficialImportDrafts(
  source: OfficialLawDataSource,
  law: OfficialLawSummary,
  detail: OfficialLawDetail,
  selectedNumbers: Iterable<string>,
  retrievedAt = new Date().toISOString(),
): ImportArticleDraft[] {
  const selected = new Set(Array.from(selectedNumbers, normalizeOfficialArticleNumber))
  const importSource: OfficialImportSource = {
    type: 'moj-law',
    provider: '法務部全國法規資料庫',
    lawCode: law.code,
    lawUrl: law.url,
    dataUpdatedAt: source.dataUpdatedAt,
    retrievedAt,
  }
  return detail.articles
    .filter((article) => selected.has(normalizeOfficialArticleNumber(article.number)))
    .map((article) => ({
      articleNumber: normalizeOfficialArticleNumber(article.number),
      title: article.heading,
      text: article.content,
      notes: '',
      importance: 3,
      mustMemorize: false,
      includeDaily: true,
      source: importSource,
    }))
}

function parseOfficialLawShard(value: unknown): OfficialLawShard {
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.laws)) throw new Error('官方法規分片格式不正確。')
  const laws = value.laws.map((law, lawIndex) => {
    if (!isRecord(law) || !Array.isArray(law.articles)) throw new Error(`官方法規分片第 ${lawIndex + 1} 筆格式不正確。`)
    const code = requiredString(law.code, `官方法規分片第 ${lawIndex + 1} 筆缺少代碼。`)
    const articles = law.articles.map((article, articleIndex) => {
      if (!isRecord(article)) throw new Error(`官方法規 ${code} 第 ${articleIndex + 1} 條格式不正確。`)
      return {
        number: requiredString(article.number, `官方法規 ${code} 有條文缺少條號。`),
        content: requiredString(article.content, `官方法規 ${code} 有條文缺少內容。`),
        heading: stringValue(article.heading),
      }
    })
    return { code, articles }
  })
  return { schemaVersion: 1, laws }
}

function parseSource(value: Record<string, unknown>): OfficialLawDataSource {
  return {
    provider: requiredString(value.provider, '官方法規索引缺少提供機關。'),
    systemName: requiredString(value.systemName, '官方法規索引缺少系統名稱。'),
    datasetName: requiredString(value.datasetName, '官方法規索引缺少資料集名稱。'),
    datasetUrl: requiredString(value.datasetUrl, '官方法規索引缺少資料集網址。'),
    apiUrl: requiredString(value.apiUrl, '官方法規索引缺少 API 網址。'),
    licenseName: requiredString(value.licenseName, '官方法規索引缺少授權名稱。'),
    licenseUrl: requiredString(value.licenseUrl, '官方法規索引缺少授權網址。'),
    dataUpdatedAt: requiredString(value.dataUpdatedAt, '官方法規索引缺少資料更新日期。'),
    generatedAt: requiredString(value.generatedAt, '官方法規索引缺少產生日期。'),
  }
}

function parseLawSummary(value: unknown, index: number): OfficialLawSummary {
  if (!isRecord(value)) throw new Error(`官方法規索引第 ${index + 1} 筆格式不正確。`)
  const status = value.status
  if (status !== 'current' && status !== 'repealed') throw new Error(`官方法規索引第 ${index + 1} 筆狀態不正確。`)
  const articleCount = Number(value.articleCount)
  if (!Number.isInteger(articleCount) || articleCount < 0) throw new Error(`官方法規索引第 ${index + 1} 筆條文數不正確。`)
  return {
    code: requiredString(value.code, `官方法規索引第 ${index + 1} 筆缺少代碼。`),
    name: requiredString(value.name, `官方法規索引第 ${index + 1} 筆缺少名稱。`),
    level: stringValue(value.level),
    category: stringValue(value.category),
    modifiedDate: stringValue(value.modifiedDate),
    effectiveDate: stringValue(value.effectiveDate),
    status,
    abandonNote: stringValue(value.abandonNote),
    url: requiredString(value.url, `官方法規索引第 ${index + 1} 筆缺少網址。`),
    articleCount,
    shard: requiredString(value.shard, `官方法規索引第 ${index + 1} 筆缺少分片。`),
  }
}

async function fetchOfficialJson(path: string): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(`${import.meta.env.BASE_URL}${path}`, { cache: 'no-store' })
  } catch {
    throw new Error('目前無法取得官方法規資料；若這是第一次使用，請連線後再試。')
  }
  if (!response.ok) {
    if (response.status === 404) throw new Error('官方法規索引尚未部署完成，請稍後再試。')
    throw new Error(`官方法規資料讀取失敗（HTTP ${response.status}）。`)
  }
  try {
    return await response.json() as unknown
  } catch {
    throw new Error('官方法規資料不是有效的 JSON。')
  }
}

function lawSearchScore(law: OfficialLawSummary, needle: string): number {
  const name = normalizeSearch(law.name)
  const code = normalizeSearch(law.code)
  const category = normalizeSearch(law.category)
  if (name === needle) return 0
  if (name.startsWith(needle)) return 1
  if (name.includes(needle)) return 2
  if (code.includes(needle)) return 3
  if (category.includes(needle)) return 4
  return 99
}

function normalizeSearch(value: string): string {
  return value.trim().toLocaleLowerCase('zh-Hant').replace(/[\s　]/g, '')
}

function requiredString(value: unknown, message: string): string {
  const parsed = stringValue(value)
  if (!parsed) throw new Error(message)
  return parsed
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : ''
}
