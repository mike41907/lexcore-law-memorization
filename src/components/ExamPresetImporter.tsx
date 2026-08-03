import { useMemo, useState } from 'react'
import {
  loadPoliceSergeantExamPreset,
  POLICE_SERGEANT_EXAM_PRESET,
  type ExamPresetBundle,
  type ExamPresetImportResult,
  type ExamSubject,
} from '../lib/examPreset'
import { Button, Notice } from './ui'

interface ExamPresetImporterProps {
  existingLawCount: number
  existingArticleCount: number
  onImport: (bundle: ExamPresetBundle) => Promise<ExamPresetImportResult>
}

const SUBJECT_ORDER: ExamSubject[] = ['憲法', '警察法規', '刑法', '刑事訴訟法']

export function ExamPresetImporter({ existingLawCount, existingArticleCount, onImport }: ExamPresetImporterProps): JSX.Element {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ExamPresetImportResult | null>(null)
  const subjects = useMemo(() => SUBJECT_ORDER.map((subject) => ({
    subject,
    laws: POLICE_SERGEANT_EXAM_PRESET.laws.filter((law) => law.subject === subject),
  })), [])

  async function importPreset(): Promise<void> {
    setBusy(true)
    setError('')
    setResult(null)
    try {
      const bundle = await loadPoliceSergeantExamPreset()
      setResult(await onImport(bundle))
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '警佐班法條預設匯入失敗。')
    } finally {
      setBusy(false)
    }
  }

  return <section className="exam-preset-card" aria-busy={busy}>
    <div className="exam-preset-head">
      <div>
        <p className="eyebrow">EXAM PRESET / 警佐班</p>
        <h3>{POLICE_SERGEANT_EXAM_PRESET.title}</h3>
        <p>依最新公開的 {POLICE_SERGEANT_EXAM_PRESET.latestScopeYear} 簡章，替 {POLICE_SERGEANT_EXAM_PRESET.targetExamYear} 先建立法條核心。</p>
      </div>
      <div className="exam-preset-coverage"><strong>{Math.min(existingLawCount, POLICE_SERGEANT_EXAM_PRESET.laws.length)} / {POLICE_SERGEANT_EXAM_PRESET.laws.length}</strong><span>部法規已建立</span><small>{existingArticleCount.toLocaleString('zh-TW')} 條在本機</small></div>
    </div>

    <div className="exam-preset-subjects">
      {subjects.map(({ subject, laws }) => <div key={subject}><span>{subject}</span><strong>{laws.length} 部</strong><small>{laws.map((law) => law.shortName).join('、')}</small></div>)}
    </div>

    <div className="exam-preset-foot">
      <div><p>同名法規會歸入四科；相同條號保留既有資料，只補缺漏，官方標示「刪除」的條文不匯入。</p><a href={POLICE_SERGEANT_EXAM_PRESET.sourceUrl} target="_blank" rel="noreferrer">查看中央警察大學官方簡章 ↗</a></div>
      <Button variant="gold" disabled={busy} onClick={() => void importPreset()}>{busy ? '正在取得並整理官方法條…' : existingLawCount >= POLICE_SERGEANT_EXAM_PRESET.laws.length ? '補齊缺漏並套用四科分類' : '建立四科分類並匯入法條'}</Button>
    </div>

    <Notice tone="warning">116 年（2027）招生簡章尚未公告；本預設以目前最新的 115 年官方範圍為基準，正式簡章公布後應再核對一次。</Notice>
    {error && <Notice tone="warning">{error}</Notice>}
    {result && <Notice tone="success">完成：建立 {result.lawsCreated} 部、更新分類 {result.lawsUpdated} 部、新增 {result.articlesAdded.toLocaleString('zh-TW')} 條；既有 {result.articlesSkipped.toLocaleString('zh-TW')} 條保留，略過 {result.deletedArticlesSkipped} 條已刪除條文。官方資料更新日 {formatDate(result.dataUpdatedAt)}。</Notice>}
  </section>
}

function formatDate(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return match ? `${match[1]}/${Number(match[2])}/${Number(match[3])}` : value
}
