import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Notice, PageHeader, ProgressBar, StatusBadge } from './ui'
import { useAppData } from '../context/AppContext'
import type { KnowledgeMastery, KnowledgePoint, KnowledgeQuestion, LawArticle } from '../types'
import { KNOWLEDGE_POINT_TYPE_LABELS } from '../lib/knowledgePointEngine'

interface Props {
  article: LawArticle
  point: KnowledgePoint
  questions: KnowledgeQuestion[]
  mastery?: KnowledgeMastery
}

export function KnowledgePointTraining({ article, point, questions, mastery }: Props): JSX.Element {
  const data = useAppData()
  const navigate = useNavigate()
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState('')
  const [result, setResult] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [startedAt, setStartedAt] = useState(Date.now())
  const question = questions[index]

  useEffect(() => {
    setIndex(0)
    setAnswer('')
    setResult(null)
    setStartedAt(Date.now())
  }, [point.id])

  async function submit(): Promise<void> {
    if (!question || !answer.trim()) return
    setBusy(true)
    try {
      const submission = await data.submitKnowledgeQuestion({ point, question, answer: answer.trim(), durationSeconds: Math.max(1, Math.floor((Date.now() - startedAt) / 1000)) })
      setResult(submission.score)
    } finally {
      setBusy(false)
    }
  }

  function next(): void {
    if (index >= questions.length - 1) {
      navigate(`/articles?law=${article.lawId}`)
      return
    }
    setIndex((value) => value + 1)
    setAnswer('')
    setResult(null)
    setStartedAt(Date.now())
  }

  if (!question) return <Notice tone="warning">此考點尚未產生題目，請回到法條頁重新整理。</Notice>

  const options = question.options ?? []
  return <div className="page-stack knowledge-training-page">
    <PageHeader eyebrow="KNOWLEDGE POINT / 考點訓練" title={point.name} description={`${article.articleNumber} 條 · ${KNOWLEDGE_POINT_TYPE_LABELS[point.type]} · 題目 ${index + 1}/${questions.length}`} actions={<Button variant="secondary" onClick={() => navigate(`/articles?law=${article.lawId}`)}>回到法條</Button>} />
    <section className="knowledge-training-meta card">
      <div><span className="eyebrow">原文依據</span><p>{point.originalSentence}</p></div>
      <div className="knowledge-training-stats"><StatusBadge status={mastery?.status ?? '未開始'} /><span>熟練度 {Math.round(mastery?.score ?? 0)}%</span><ProgressBar value={mastery?.score ?? 0} showValue={false} tone={(mastery?.score ?? 0) >= 90 ? 'green' : (mastery?.score ?? 0) >= 70 ? 'gold' : 'red'} /></div>
    </section>
    <section className="knowledge-question-card card">
      <div className="training-label"><span className="task-type task-new">{question.type}</span><span>只針對這一個考點作答</span></div>
      <h2>{question.prompt}</h2>
      {options.length > 0 && <div className="knowledge-options">{options.map((option) => <button type="button" key={option} className={answer === option ? 'selected' : ''} onClick={() => setAnswer(option)} disabled={result !== null}>{option}</button>)}</div>}
      {options.length === 0 && <textarea className="knowledge-answer" value={answer} onChange={(event) => setAnswer(event.target.value)} rows={5} placeholder="輸入你的答案" disabled={result !== null} />}
      {result === null ? <Button onClick={() => void submit()} disabled={busy || !answer.trim()}>{busy ? '判定中…' : '提交答案'}</Button> : <div className="knowledge-result"><Notice tone={result >= 80 ? 'success' : 'warning'}><strong>{result >= 80 ? '答對，繼續保持' : '這題需要再複習'}</strong> · 得分 {result}</Notice><p className="knowledge-explanation">原文：{question.explanation}</p><Button onClick={next}>{index >= questions.length - 1 ? '完成考點' : '下一題'}</Button></div>}
    </section>
  </div>
}
