import type { ArticleSection, ImportArticleDraft, LawArticle } from '../types'
import { makeId } from './utils'

const ARTICLE_HEADING = /第\s*([0-9０-９一二三四五六七八九十百千〇零○]+)\s*條/g

export function normalizeArticleNumber(value: string): string {
  return value
    .replace(/[　\s]/g, '')
    .replace(/^第/, '')
    .replace(/條$/, '')
    .replace(/[０-９]/g, (character) => String.fromCharCode(character.charCodeAt(0) - 0xff10 + 0x30))
}

export function splitLawText(input: string): ImportArticleDraft[] {
  const text = input.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').trim()
  if (!text) return []
  const matches = Array.from(text.matchAll(ARTICLE_HEADING))
  if (!matches.length) {
    return [{ articleNumber: '未編號', title: '', text, notes: '匯入內容未偵測到「第○條」標題，請在預覽中補上條號。', importance: 3 as const, mustMemorize: false, includeDaily: true }]
  }
  return matches.map((match, index) => {
    const start = match.index ?? 0
    const bodyStart = start + match[0].length
    const nextStart = index + 1 < matches.length ? matches[index + 1].index ?? text.length : text.length
    const body = text.slice(bodyStart, nextStart).trim()
    return {
      articleNumber: normalizeArticleNumber(match[1] ?? '未編號'),
      title: '',
      text: body,
      notes: '',
      importance: 3 as const,
      mustMemorize: false,
      includeDaily: true,
    }
  }).filter((draft) => draft.text.length > 0)
}

export function parseJsonImport(input: unknown): ImportArticleDraft[] {
  const payload = typeof input === 'string' ? JSON.parse(input) as unknown : input
  const list = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.articles)
      ? payload.articles
      : []
  if (!list.length) throw new Error('JSON 中找不到 articles 陣列或可匯入的法條資料。')
  return list.map((item, index) => {
    if (!isRecord(item)) throw new Error(`第 ${index + 1} 筆 JSON 法條格式錯誤。`)
    const text = String(item.text ?? item.content ?? '').trim()
    if (!text) throw new Error(`第 ${index + 1} 筆 JSON 法條缺少 text 內容。`)
    return {
      articleNumber: normalizeArticleNumber(String(item.articleNumber ?? item.number ?? index + 1)),
      title: String(item.title ?? ''),
      text,
      notes: String(item.notes ?? ''),
      importance: parseImportance(item.importance),
      mustMemorize: Boolean(item.mustMemorize),
      includeDaily: item.includeDaily !== false,
    }
  })
}

export function splitIntoSections(text: string, articleId: string): ArticleSection[] {
  const normalized = text.replace(/\r\n/g, '\n').trim()
  if (!normalized) return []
  const lines = normalized.split(/\n+/).map((line) => line.trim()).filter(Boolean)
  const source = lines.length > 1 ? lines : splitBySentence(normalized)
  return source.map((part, index) => ({
    id: makeId('section'),
    articleId,
    order: index,
    type: classifySection(part),
    text: part,
  }))
}

export function splitBySentence(text: string): string[] {
  const parts = text.match(/[^。！？；：;!?]+[。！？；：;!?]?/g) ?? [text]
  return parts.map((part) => part.trim()).filter(Boolean)
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function articleToDraft(article: LawArticle): ImportArticleDraft {
  return {
    articleNumber: article.articleNumber,
    title: article.title,
    text: article.text,
    notes: article.notes,
    importance: article.importance,
    mustMemorize: article.mustMemorize,
    includeDaily: article.includeDaily,
    source: article.source,
  }
}

function classifySection(value: string): ArticleSection['type'] {
  if (/^[（(]?[一二三四五六七八九十百千0-9０-９]+[）)、.．]/.test(value)) return 'item'
  if (/^[（(]?[甲乙丙丁戊己庚辛壬癸]+[）)、.．]/.test(value)) return 'subitem'
  return 'paragraph'
}

function parseImportance(value: unknown): 1 | 2 | 3 | 4 | 5 {
  const parsed = Number(value)
  if (parsed <= 1) return 1
  if (parsed === 2) return 2
  if (parsed === 4) return 4
  if (parsed >= 5) return 5
  return 3
}
