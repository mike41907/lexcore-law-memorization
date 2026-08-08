import type { ExamSubject, LawCollection, LawType } from '../types'

export const EXAM_SUBJECTS: Array<{ id: Exclude<ExamSubject, 'unclassified'>; label: string; shortLabel: string; description: string }> = [
  { id: 'criminal-law', label: '刑法', shortLabel: '刑法', description: '犯罪成立、刑罰與總則／分則架構' },
  { id: 'constitution', label: '憲法', shortLabel: '憲法', description: '憲法本文、增修條文與相關法規' },
  { id: 'police-law', label: '警察法規', shortLabel: '警察法規', description: '警察職權、警械、社維法與相關子法' },
  { id: 'police-duty', label: '警察勤務', shortLabel: '警察勤務', description: '警察勤務條例與勤務制度相關法規' },
  { id: 'criminal-procedure', label: '刑事訴訟法', shortLabel: '刑訴', description: '偵查、強制處分、證據、審判與救濟' },
]

export const EXAM_SUBJECT_LABELS: Record<ExamSubject, string> = {
  'criminal-law': '刑法',
  constitution: '憲法',
  'police-law': '警察法規',
  'police-duty': '警察勤務',
  'criminal-procedure': '刑事訴訟法',
  unclassified: '尚未分類',
}

export const LAW_TYPE_LABELS: Record<LawType, string> = {
  core: '核心法規',
  'sub-law': '子法',
  'implementing-rules': '施行細則',
  measure: '辦法',
  regulation: '規則',
  order: '命令',
  other: '其他',
}

export function migrateLawCollectionsToExamSubjects(laws: LawCollection[]): { laws: LawCollection[]; changed: LawCollection[] } {
  const changed: LawCollection[] = []
  const migrated = laws.map((law) => {
    const examSubject = law.examSubject ?? classifyExamSubject(law)
    const lawType = law.lawType ?? classifyLawType(law)
    const next = { ...law, examSubject, lawType }
    if (next.examSubject !== law.examSubject || next.lawType !== law.lawType) changed.push(next)
    return next
  })
  return { laws: migrated, changed }
}

export function classifyExamSubject(law: Pick<LawCollection, 'name' | 'shortName' | 'category' | 'source'>): ExamSubject {
  const name = normalize(law.name)
  const shortName = normalize(law.shortName)
  const category = normalize(law.category)
  const sourceCode = law.source?.lawCode ?? ''

  if (sourceCode === 'C0000001' || name === '刑法' || shortName === '刑法') return 'criminal-law'
  if (sourceCode === 'A0000001' || sourceCode === 'A0000002' || name.includes('憲法')) return 'constitution'
  if (sourceCode === 'C0010001' || name === '刑事訴訟法' || shortName === '刑訴') return 'criminal-procedure'
  if (name === '警察勤務條例' || name === '警察勤務法') return 'police-duty'
  if (category === '警察勤務') return 'police-duty'
  if (category === '警察法規' || category === '警察法') return 'police-law'
  if (name === '警察法' || name === '警察職權行使法' || name === '警械使用條例' || name === '社會秩序維護法') return 'police-law'
  return 'unclassified'
}

export function classifyLawType(law: Pick<LawCollection, 'name' | 'source'>): LawType {
  const name = normalize(law.name)
  if (name === '刑法' || name === '憲法' || name === '憲法增修條文' || name === '刑事訴訟法' || name === '警察法' || name === '警察勤務條例' || name === '警察職權行使法' || name === '警械使用條例' || name === '社會秩序維護法') return 'core'
  if (name.includes('施行細則')) return 'implementing-rules'
  if (name.includes('辦法')) return 'measure'
  if (name.includes('規則')) return 'regulation'
  if (name.includes('命令') || name.includes('作業規定') || name.includes('要點')) return 'order'
  if (law.source?.type === 'moj-law') return 'sub-law'
  return 'other'
}

export function subjectLabel(subject: ExamSubject | undefined): string {
  return EXAM_SUBJECT_LABELS[subject ?? 'unclassified']
}

function normalize(value: string): string {
  return value.trim().replace(/^中華民國/, '').replace(/[\s　、｜|]/g, '')
}
