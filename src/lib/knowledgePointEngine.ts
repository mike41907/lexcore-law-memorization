import type {
  AppSettings,
  ArticleSection,
  ISODate,
  KnowledgeMastery,
  KnowledgePoint,
  KnowledgePointType,
  KnowledgeQuestion,
  KnowledgeQuestionType,
  KnowledgeReview,
  LawArticle,
} from '../types'
import { clamp, makeId, nowIso } from './utils'

export const KNOWLEDGE_POINT_TYPE_LABELS: Record<KnowledgePointType, string> = {
  GENERAL_PRINCIPLE: '一般原則',
  SUBJECT: '主體／權限',
  OBJECT: '客體',
  CONDITION: '構成要件',
  LEGAL_EFFECT: '法律效果／刑罰',
  PROCEDURE: '程序',
  NUMBER: '數字',
  TIME_LIMIT: '期間／期限',
  AMOUNT: '金額',
  AGE: '年齡',
  MUST: '應為事項',
  MAY: '得為事項',
  PROHIBITED: '禁止事項',
  EXCEPTION: '例外',
  PROVISO: '但書',
  DEFINITION: '定義',
  ORDER: '順序',
  CUSTOM: '自訂',
}

const NUMBER_PATTERN = /(?:\d+(?:\.\d+)?|[零一二三四五六七八九十百千萬]+)\s*(?:年|月|日|時|小時|分鐘|分|秒|元|歲|人|日內|年內)/g
const SENTENCE_SPLIT = /(?<=[。！？；;\n])|\n+/u

export function buildKnowledgePoints(article: LawArticle, sections: ArticleSection[] = []): KnowledgePoint[] {
  const timestamp = nowIso()
  const sourceSentences = getSourceSentences(article, sections)
  const candidates: Array<{ type: KnowledgePointType; sentence: string; name: string; number?: string }> = []

  for (const sentence of sourceSentences) {
    const trimmed = sentence.trim()
    if (!trimmed) continue
    const numbers = trimmed.match(NUMBER_PATTERN) ?? []
    const add = (type: KnowledgePointType, name: string, number?: string): void => {
      candidates.push({ type, sentence: trimmed, name, number })
    }
    if (/定義|稱.{0,12}(為|謂)|所謂/.test(trimmed)) add('DEFINITION', '定義：' + shorten(trimmed))
    if (/不得|禁止|不應|禁止/.test(trimmed)) add('PROHIBITED', '禁止事項：' + shorten(trimmed))
    if (/應(?:於|在|由|依|向|將|予|為)|應當|有義務/.test(trimmed)) add('MUST', '應為事項：' + shorten(trimmed))
    if (/得(?:於|在|由|依|向|以|為)|可以|得以/.test(trimmed)) add('MAY', '得為事項：' + shorten(trimmed))
    if (/但書|但[、，]|除非|除外|例外/.test(trimmed)) add(/但書/.test(trimmed) ? 'PROVISO' : 'EXCEPTION', '例外／但書：' + shorten(trimmed))
    if (/下列|具備|符合|要件|構成要件|情形/.test(trimmed)) add('CONDITION', '構成要件：' + shorten(trimmed))
    if (/法院|檢察官|檢察署|司法警察|警察機關|主管機關/.test(trimmed)) add('PROCEDURE', '程序主體：' + shorten(trimmed))
    if (/依序|順序|先.{0,18}後|次序/.test(trimmed)) add('ORDER', '順序：' + shorten(trimmed))
    if (/處以|處罰|刑罰|有期徒刑|拘役|罰金|罰鍰|沒收|科以/.test(trimmed)) add('LEGAL_EFFECT', '法律效果：' + shorten(trimmed))
    if (numbers.length) {
      for (const number of numbers) {
        const normalized = number.replace(/\s+/g, '')
        const type = /元/.test(normalized) ? 'AMOUNT' : /歲/.test(normalized) ? 'AGE' : /年|月|日|時|分|秒/.test(normalized) ? 'TIME_LIMIT' : 'NUMBER'
        add(type, `${KNOWLEDGE_POINT_TYPE_LABELS[type]}：${normalized}`, normalized)
      }
    }
    if (!candidates.some((candidate) => candidate.sentence === trimmed && candidate.type === 'GENERAL_PRINCIPLE')) {
      add('GENERAL_PRINCIPLE', '核心規則：' + shorten(trimmed))
    }
  }

  const unique = new Map<string, KnowledgePoint>()
  for (const candidate of candidates) {
    const key = `${candidate.type}:${normalize(candidate.sentence)}:${candidate.number ?? ''}`
    if (unique.has(key)) continue
    const index = sourceSentences.indexOf(candidate.sentence)
    const section = index >= 0 ? sections[index] : undefined
    unique.set(key, {
      id: makeId('kp'),
      articleId: article.id,
      name: candidate.name,
      type: candidate.type,
      importance: Math.max(1, Math.min(5, article.importance + (article.mustMemorize ? 1 : 0))) as 1 | 2 | 3 | 4 | 5,
      difficulty: candidate.type === 'NUMBER' || candidate.type === 'TIME_LIMIT' || candidate.type === 'AMOUNT' || candidate.type === 'AGE' ? 5 : candidate.type === 'GENERAL_PRINCIPLE' ? 3 : 4,
      keywords: extractKeywords(candidate.sentence, candidate.number),
      originalSentence: candidate.sentence,
      paragraph: section?.type === 'paragraph' ? section.order : undefined,
      item: section?.type === 'item' ? section.order : undefined,
      subitem: section?.type === 'subitem' ? section.order : undefined,
      number: candidate.number,
      dependencies: [],
      relatedPoints: [],
      confusionPoints: [],
      source: 'rule',
      createdAt: timestamp,
      updatedAt: timestamp,
    })
  }
  return Array.from(unique.values())
}

export function generateKnowledgeQuestions(point: KnowledgePoint, article: LawArticle, corpus: LawArticle[] = []): KnowledgeQuestion[] {
  const timestamp = nowIso()
  const result: KnowledgeQuestion[] = []
  const add = (type: KnowledgeQuestionType, prompt: string, answer: string | string[], options?: string[], explanation = point.originalSentence): void => {
    result.push({ id: makeId('kpq'), knowledgePointId: point.id, articleId: article.id, type, prompt, options, answer, explanation, difficulty: point.difficulty, isActive: true, source: 'rule', createdAt: timestamp, updatedAt: timestamp })
  }
  const expected = point.number ?? firstNumber(point.originalSentence) ?? point.originalSentence
  if (point.type === 'NUMBER' || point.type === 'TIME_LIMIT' || point.type === 'AMOUNT' || point.type === 'AGE') {
    add('number', `本考點的數字應為何？\n${maskValue(point.originalSentence, expected)}`, expected)
    const distractor = findDistractor(expected, corpus) ?? makeSafeDistractor(expected)
    add('comparison', `下列哪一個數字符合原文「${shorten(point.originalSentence)}」？`, expected, [expected, distractor])
  } else if (point.type === 'MUST' || point.type === 'MAY' || point.type === 'PROHIBITED') {
    const keyword = point.type === 'MUST' ? '應' : point.type === 'MAY' ? '得' : '不得'
    add('must-may', `原文在此處使用的規範強度為何？\n${maskValue(point.originalSentence, keyword)}`, keyword, ['應', '得', '不得'])
    add('true-false', `判斷：下列句子完整符合原文的規範強度。\n${point.originalSentence}`, 'true')
  } else if (point.type === 'LEGAL_EFFECT') {
    add('cloze', `請補回法律效果：\n${maskValue(point.originalSentence, point.originalSentence.slice(Math.max(0, point.originalSentence.indexOf('處')), Math.min(point.originalSentence.length, point.originalSentence.indexOf('處') + 12)))}`, point.originalSentence)
    add('true-false', `判斷：下列法律效果敘述與原文一致。\n${point.originalSentence}`, 'true')
  } else {
    add('cloze', `請補回本考點原文：\n${maskValue(point.originalSentence, keyToken(point.originalSentence))}`, point.originalSentence)
    add('true-false', `判斷：下列敘述與本考點原文一致。\n${point.originalSentence}`, 'true')
  }
  return result.slice(0, 20)
}

export function createInitialKnowledgeMastery(point: KnowledgePoint, now: ISODate = nowIso()): KnowledgeMastery {
  return { id: `kpm-${point.id}`, knowledgePointId: point.id, articleId: point.articleId, score: 0, status: '未開始', attempts: 0, correct: 0, errorFrequency: 0, consecutiveCorrect: 0, lastScore: 0, updatedAt: now }
}

export function createInitialKnowledgeReview(point: KnowledgePoint, settings: AppSettings, now = new Date()): KnowledgeReview {
  const firstInterval = settings.reviewIntervals[0] ?? 0.007
  return { id: `kpr-${point.id}`, knowledgePointId: point.id, articleId: point.articleId, stage: 0, intervalDays: firstInterval, nextReviewAt: new Date(now.getTime() + firstInterval * 86_400_000).toISOString(), consecutiveCorrect: 0, lapses: 0, crossDayPasses: 0 }
}

export function updateKnowledgeMastery(previous: KnowledgeMastery | undefined, point: KnowledgePoint, score: number, now: ISODate = nowIso()): KnowledgeMastery {
  const current = previous ?? createInitialKnowledgeMastery(point, now)
  const attempts = current.attempts + 1
  const correct = current.correct + (score >= 80 ? 1 : 0)
  const errorFrequency = ((current.errorFrequency * current.attempts) + (score < 80 ? 1 : 0)) / attempts
  const nextScore = Math.round(((current.score * current.attempts) + score) / attempts * 10) / 10
  const consecutiveCorrect = score >= 90 ? current.consecutiveCorrect + 1 : 0
  const status = pointStatus(nextScore, attempts, score)
  return { ...current, score: clamp(nextScore, 0, 100), status, attempts, correct, errorFrequency: Math.round(errorFrequency * 1000) / 1000, consecutiveCorrect, lastScore: score, lastReviewAt: now, updatedAt: now }
}

export function updateKnowledgeReview(previous: KnowledgeReview | undefined, point: KnowledgePoint, settings: AppSettings, score: number, now = new Date()): KnowledgeReview {
  const current = previous ?? createInitialKnowledgeReview(point, settings, now)
  const passed = score >= 80
  const stage = passed ? Math.min(current.stage + 1, Math.max(0, settings.reviewIntervals.length - 1)) : Math.max(0, current.stage - 1)
  const intervalDays = settings.reviewIntervals[stage] ?? (passed ? Math.min(90, Math.max(1, current.intervalDays * 2)) : 0.007)
  return { ...current, stage, intervalDays, nextReviewAt: new Date(now.getTime() + intervalDays * 86_400_000).toISOString(), lastReviewedAt: now.toISOString(), lastScore: score, consecutiveCorrect: passed ? current.consecutiveCorrect + 1 : 0, lapses: passed ? current.lapses : current.lapses + 1, crossDayPasses: passed && intervalDays >= 1 ? current.crossDayPasses + 1 : current.crossDayPasses }
}

export function scoreKnowledgeAnswer(expected: string | string[], actual: string): number {
  const expectedValues = Array.isArray(expected) ? expected : [expected]
  const normalizedActual = normalize(actual)
  if (!normalizedActual) return 0
  if (expectedValues.some((value) => normalize(value) === normalizedActual)) return 100
  if (expectedValues.some((value) => normalizedActual.includes(normalize(value)) || normalize(value).includes(normalizedActual))) return 75
  return 0
}

function pointStatus(score: number, attempts: number, lastScore: number): KnowledgeMastery['status'] {
  if (!attempts) return '未開始' as KnowledgeMastery['status']
  if (lastScore < 70) return '高風險' as KnowledgeMastery['status']
  if (score >= 90) return '已熟練' as KnowledgeMastery['status']
  if (score >= 70) return '尚未穩定' as KnowledgeMastery['status']
  return '學習中' as KnowledgeMastery['status']
}

function getSourceSentences(article: LawArticle, sections: ArticleSection[]): string[] {
  const sectionText = sections.filter((section) => section.articleId === article.id).sort((a, b) => a.order - b.order).map((section) => section.text.trim()).filter(Boolean)
  const raw = sectionText.length ? sectionText : article.text.split(SENTENCE_SPLIT)
  return raw.map((sentence) => sentence.trim()).filter(Boolean)
}

function extractKeywords(sentence: string, number?: string): string[] {
  return Array.from(new Set([...(sentence.match(/應|得|不得|但書|但|有下列情形|法院|檢察官|司法警察|警察機關/g) ?? []), ...(number ? [number] : [])]))
}

function firstNumber(value: string): string | undefined {
  return value.match(NUMBER_PATTERN)?.[0]?.replace(/\s+/g, '')
}

function findDistractor(expected: string, corpus: LawArticle[]): string | undefined {
  return corpus.flatMap((article) => article.text.match(NUMBER_PATTERN) ?? []).map((value) => value.replace(/\s+/g, '')).find((value) => value !== expected)
}

function makeSafeDistractor(expected: string): string {
  const match = expected.match(/\d+/)
  if (!match) return `${expected}（易混淆）`
  return expected.replace(match[0], String(Number(match[0]) + 1))
}

function maskValue(sentence: string, value: string): string {
  if (!value) return sentence
  return sentence.replace(value, '＿＿＿＿')
}

function keyToken(sentence: string): string {
  return sentence.match(/應|得|不得|但書|下列|法院|檢察官|刑|罰|期間|期限/)?.[0] ?? sentence.slice(0, Math.min(8, sentence.length))
}

function shorten(value: string, length = 34): string {
  return value.length > length ? `${value.slice(0, length)}…` : value
}

function normalize(value: string): string {
  return value.normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu, '').toLocaleLowerCase('zh-Hant')
}
