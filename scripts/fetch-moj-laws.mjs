import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { strFromU8, unzipSync } from 'fflate'

const API_URL = 'https://law.moj.gov.tw/api/Ch/Law/JSON'
const DATASET_URL = 'https://data.gov.tw/dataset/18289'
const LICENSE_URL = 'https://data.gov.tw/license'
const SHARD_SIZE = 50
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const publicRoot = resolve(projectRoot, 'public')
const outputDir = resolve(publicRoot, 'official')
const shardDir = resolve(outputDir, 'shards')

if (!outputDir.startsWith(`${publicRoot}${sep}`)) throw new Error('拒絕清除 public 目錄以外的路徑。')

const response = await fetch(API_URL, {
  headers: { 'User-Agent': 'LexCore-GitHub-Pages-Data-Builder/1.0' },
})
if (!response.ok) throw new Error(`法務部 API 下載失敗：HTTP ${response.status}`)

const archiveBytes = new Uint8Array(await response.arrayBuffer())
if (archiveBytes[0] !== 0x50 || archiveBytes[1] !== 0x4b) throw new Error('法務部 API 回傳內容不是 ZIP 壓縮檔。')
const archive = unzipSync(archiveBytes)
const jsonBytes = archive['ChLaw.json']
if (!jsonBytes) throw new Error('法務部 ZIP 中找不到 ChLaw.json。')

const raw = JSON.parse(strFromU8(jsonBytes))
if (!raw || !Array.isArray(raw.Laws)) throw new Error('ChLaw.json 缺少 Laws 陣列。')

const dataUpdatedAt = normalizeMojDate(raw.UpdateDate)
const normalized = raw.Laws.map(normalizeLaw).filter((law) => law.articles.length > 0)
const seenCodes = new Set()
for (const law of normalized) {
  if (seenCodes.has(law.code)) throw new Error(`法規代碼重複：${law.code}`)
  seenCodes.add(law.code)
}

await rm(outputDir, { recursive: true, force: true })
await mkdir(shardDir, { recursive: true })

const summaries = []
for (let start = 0; start < normalized.length; start += SHARD_SIZE) {
  const shardLaws = normalized.slice(start, start + SHARD_SIZE)
  const shardName = `${String(start / SHARD_SIZE).padStart(3, '0')}.json`
  await writeJson(resolve(shardDir, shardName), {
    schemaVersion: 1,
    laws: shardLaws.map((law) => ({ code: law.code, articles: law.articles })),
  })
  for (const law of shardLaws) {
    summaries.push({
      code: law.code,
      name: law.name,
      level: law.level,
      category: law.category,
      modifiedDate: law.modifiedDate,
      effectiveDate: law.effectiveDate,
      status: law.abandonNote ? 'repealed' : 'current',
      abandonNote: law.abandonNote,
      url: law.url,
      articleCount: law.articles.length,
      shard: shardName,
    })
  }
}

const index = {
  schemaVersion: 1,
  source: {
    provider: '法務部',
    systemName: '全國法規資料庫',
    datasetName: '中文法規_法律資料檔下載',
    datasetUrl: DATASET_URL,
    apiUrl: API_URL,
    licenseName: '政府資料開放授權條款第1版',
    licenseUrl: LICENSE_URL,
    dataUpdatedAt,
    generatedAt: new Date().toISOString(),
  },
  laws: summaries,
}
await writeJson(resolve(outputDir, 'moj-law-index.json'), index)

const articleCount = normalized.reduce((total, law) => total + law.articles.length, 0)
console.log(`MOJ_DATA_OK laws=${normalized.length} articles=${articleCount} shards=${Math.ceil(normalized.length / SHARD_SIZE)} updated=${dataUpdatedAt}`)

function normalizeLaw(value, index) {
  if (!value || typeof value !== 'object') throw new Error(`第 ${index + 1} 筆法規格式錯誤。`)
  const url = requiredText(value.LawURL, `第 ${index + 1} 筆法規缺少 LawURL。`)
  const code = new URL(url).searchParams.get('pcode')
  if (!code) throw new Error(`第 ${index + 1} 筆法規網址缺少 pcode。`)
  let heading = ''
  const articles = []
  for (const item of Array.isArray(value.LawArticles) ? value.LawArticles : []) {
    if (!item || typeof item !== 'object') continue
    if (item.ArticleType === 'C') {
      heading = normalizeText(item.ArticleContent)
      continue
    }
    if (item.ArticleType !== 'A') continue
    const content = normalizeText(item.ArticleContent)
    if (!content) continue
    articles.push({
      number: normalizeArticleNumber(requiredText(item.ArticleNo, `${code} 有條文缺少 ArticleNo。`)),
      content,
      heading,
    })
  }
  return {
    code,
    name: requiredText(value.LawName, `${code} 缺少 LawName。`),
    level: text(value.LawLevel),
    category: text(value.LawCategory),
    modifiedDate: text(value.LawModifiedDate),
    effectiveDate: text(value.LawEffectiveDate),
    abandonNote: text(value.LawAbandonNote),
    url,
    articles,
  }
}

function normalizeArticleNumber(value) {
  return value
    .replace(/^\s*第\s*/, '')
    .replace(/\s*條\s*$/, '')
    .replace(/[　\s]/g, '')
    .replace(/[０-９]/g, (character) => String.fromCharCode(character.charCodeAt(0) - 0xff10 + 0x30))
}

function normalizeMojDate(value) {
  const match = text(value).match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/)
  if (!match) throw new Error(`無法辨識法務部資料更新日期：${text(value)}`)
  return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`
}

function normalizeText(value) {
  return text(value).replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
}

function requiredText(value, message) {
  const parsed = text(value).trim()
  if (!parsed) throw new Error(message)
  return parsed
}

function text(value) {
  return typeof value === 'string' ? value : ''
}

async function writeJson(path, value) {
  await writeFile(path, JSON.stringify(value), 'utf8')
}
