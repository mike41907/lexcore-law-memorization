import type { ImportArticleDraft } from '../types'
import {
  createOfficialImportDrafts,
  fetchOfficialLawDetails,
  fetchOfficialLawIndex,
  type OfficialLawDataSource,
  type OfficialLawDetail,
  type OfficialLawIndex,
  type OfficialLawSummary,
} from './officialLaws'

export type ExamSubject = '憲法' | '警察法規' | '刑法' | '刑事訴訟法'

export interface ExamPresetLawSpec {
  name: string
  shortName: string
  subject: ExamSubject
  paperName: string
}

export interface ExamPresetDefinition {
  id: string
  title: string
  latestScopeYear: string
  targetExamYear: string
  sourceLabel: string
  sourceUrl: string
  laws: ExamPresetLawSpec[]
}

export interface ExamPresetLawBundle {
  spec: ExamPresetLawSpec
  summary: OfficialLawSummary
  drafts: ImportArticleDraft[]
  deletedArticleCount: number
}

export interface ExamPresetBundle {
  definition: ExamPresetDefinition
  officialSource: OfficialLawDataSource
  laws: ExamPresetLawBundle[]
}

export interface ExamPresetImportResult {
  lawIds: string[]
  lawsCreated: number
  lawsUpdated: number
  articlesAdded: number
  articlesSkipped: number
  deletedArticlesSkipped: number
  dataUpdatedAt: string
}

export const POLICE_SERGEANT_EXAM_PRESET: ExamPresetDefinition = {
  id: 'cpu-police-sergeant-legal-core-115',
  title: '警佐班四科法條核心',
  latestScopeYear: '115 年警佐班第 46 期',
  targetExamYear: '116 年（2027）',
  sourceLabel: '中央警察大學 115 年警佐班第 46 期第 1、2、3 類招生簡章',
  sourceUrl: 'https://daa.cpu.edu.tw/p/404-1033-45383.php',
  laws: [
    { name: '中華民國憲法', shortName: '憲法', subject: '憲法', paperName: '國文與憲法' },
    { name: '中華民國憲法增修條文', shortName: '憲法增修條文', subject: '憲法', paperName: '國文與憲法' },
    { name: '警察法', shortName: '警察法', subject: '警察法規', paperName: '警察法規' },
    { name: '社會秩序維護法', shortName: '社維法', subject: '警察法規', paperName: '警察法規' },
    { name: '警械使用條例', shortName: '警械條例', subject: '警察法規', paperName: '警察法規' },
    { name: '警察職權行使法', shortName: '警職法', subject: '警察法規', paperName: '警察法規' },
    { name: '中華民國刑法', shortName: '刑法', subject: '刑法', paperName: '刑法及刑事訴訟法' },
    { name: '刑事訴訟法', shortName: '刑訴', subject: '刑事訴訟法', paperName: '刑法及刑事訴訟法' },
  ],
}

export async function loadPoliceSergeantExamPreset(): Promise<ExamPresetBundle> {
  const index = await fetchOfficialLawIndex()
  const summaries = resolvePresetSummaries(index, POLICE_SERGEANT_EXAM_PRESET)
  const details = await fetchOfficialLawDetails(summaries)
  return buildExamPresetBundle(index, POLICE_SERGEANT_EXAM_PRESET, summaries, details)
}

export function resolvePresetSummaries(index: OfficialLawIndex, definition: ExamPresetDefinition): OfficialLawSummary[] {
  return definition.laws.map((spec) => {
    const summary = index.laws.find((law) => law.status === 'current' && normalizeName(law.name) === normalizeName(spec.name))
    if (!summary) throw new Error(`官方資料中找不到現行「${spec.name}」，本次未寫入任何資料。`)
    return summary
  })
}

export function buildExamPresetBundle(
  index: OfficialLawIndex,
  definition: ExamPresetDefinition,
  summaries: OfficialLawSummary[],
  details: OfficialLawDetail[],
  retrievedAt = new Date().toISOString(),
): ExamPresetBundle {
  if (summaries.length !== definition.laws.length || details.length !== definition.laws.length) {
    throw new Error('國考預設法規資料不完整，本次未寫入任何資料。')
  }
  const laws = definition.laws.map((spec, indexPosition) => {
    const summary = summaries[indexPosition]
    const detail = details[indexPosition]
    if (detail.code !== summary.code) throw new Error(`「${spec.name}」的官方條文資料不一致，本次未寫入任何資料。`)
    const allDrafts = createOfficialImportDrafts(index.source, summary, detail, detail.articles.map((article) => article.number), retrievedAt)
    const drafts = allDrafts
      .filter((draft) => !isDeletedArticleText(draft.text))
      .map((draft) => ({ ...draft, importance: 3 as const, mustMemorize: false, includeDaily: true }))
    return { spec, summary, drafts, deletedArticleCount: allDrafts.length - drafts.length }
  })
  return { definition, officialSource: index.source, laws }
}

export function isDeletedArticleText(value: string): boolean {
  return /^[（(]?\s*刪除\s*[）)]?[。.]?$/.test(value.trim())
}

export function presetScopeNote(definition: ExamPresetDefinition, spec: ExamPresetLawSpec): string {
  return `${definition.latestScopeYear}「${spec.paperName}」法條核心；依中央警察大學最新公開簡章建立。${definition.targetExamYear}簡章公布後仍應再核對。`
}

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase('zh-Hant').replace(/[\s　]/g, '')
}
