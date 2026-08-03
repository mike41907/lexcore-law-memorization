import type { OfficialLawArticle, OfficialLawDetail, OfficialLawSummary } from './officialLaws'

export interface OfficialCommandSpec {
  code: string
  name: string
  url: string
  category: string
}

export const POLICE_SUBLAW_COMMANDS: OfficialCommandSpec[] = [
  { code: 'D0080070', name: '違反社會秩序維護法案件處理辦法', url: 'https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=D0080070', category: '行政 ＞ 內政部 ＞ 警政目' },
  { code: 'D0080076', name: '地方法院與警察機關處理違反社會秩序維護法案件聯繫辦法', url: 'https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=D0080076', category: '行政 ＞ 內政部 ＞ 警政目' },
]

export function createOfficialCommandSummary(spec: OfficialCommandSpec): OfficialLawSummary {
  return { code: spec.code, name: spec.name, level: '行政命令', category: spec.category, modifiedDate: '', effectiveDate: '', status: 'current', abandonNote: '', url: spec.url, articleCount: 0, shard: '' }
}

export async function fetchOfficialCommandDetail(summary: OfficialLawSummary): Promise<OfficialLawDetail> {
  let response: Response
  try { response = await fetch(`${import.meta.env.BASE_URL}official/commands/${summary.code}.json`, { cache: 'no-store' }) } catch { throw new Error(`目前無法取得內建官方子法「${summary.name}」；請重新整理後再試。`) }
  if (!response.ok) throw new Error(`內建官方子法「${summary.name}」資料遺失（HTTP ${response.status}）。`)
  const parsed = await response.json() as Partial<OfficialLawDetail>
  if (parsed.code !== summary.code || !Array.isArray(parsed.articles) || !parsed.articles.length) throw new Error(`內建官方子法「${summary.name}」資料格式不正確。`)
  return parsed as OfficialLawDetail
}

export function parseOfficialCommandHtml(html: string, code: string, name: string): OfficialLawDetail {
  const rowStarts = Array.from(html.matchAll(/<div class="row"><div class="col-no">/g), (match) => match.index ?? 0)
  const headings = Array.from(html.matchAll(/<div class="h[34][^"]*">([\s\S]*?)<\/div>/g), (match) => ({ position: match.index ?? 0, value: cleanHtml(match[1]) }))
  const articles: OfficialLawArticle[] = []
  for (let index = 0; index < rowStarts.length; index += 1) {
    const start = rowStarts[index]
    const chunk = html.slice(start, rowStarts[index + 1] ?? html.length)
    const numberMatch = chunk.match(/<a[^>]*name="([^"]+)"[^>]*>([\s\S]*?)<\/a>/)
    if (!numberMatch) continue
    const lines = Array.from(chunk.matchAll(/<div class="line-0000[^>]*>([\s\S]*?)<\/div>/g), (match) => cleanHtml(match[1])).filter(Boolean)
    if (!lines.length) continue
    const heading = [...headings].reverse().find((item) => item.position < start)?.value ?? ''
    articles.push({ number: numberMatch[1], content: lines.join('\n'), heading })
  }
  if (!articles.length) throw new Error(`官方子法「${name}」沒有讀到條文，為避免匯入空資料已停止。`)
  return { code, articles }
}

function cleanHtml(value: string): string { return decodeEntities(value.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()) }

function decodeEntities(value: string): string {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (whole, entity: string) => {
    const lower = entity.toLowerCase()
    if (lower === 'amp') return '&'
    if (lower === 'lt') return '<'
    if (lower === 'gt') return '>'
    if (lower === 'quot') return '"'
    if (lower === 'apos') return "'"
    if (lower === 'nbsp') return ' '
    const codePoint = lower.startsWith('#x') ? Number.parseInt(lower.slice(2), 16) : Number.parseInt(lower.slice(1), 10)
    return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : whole
  })
}
