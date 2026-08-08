import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Notice, PageHeader, ProgressBar, StatusBadge } from './ui'
import { useAppData } from '../context/AppContext'
import type { LawArticle } from '../types'
import { splitBySentence } from '../lib/importer'
import { extractNumericFacts, type NumericFact } from '../lib/numericTraining'
import { extractKeywordTraps, type KeywordTrap } from '../lib/keywordTraining'

type PrecisionStep = 1 | 2 | 3 | 4
type Checkpoint = { kind: 'number' | 'keyword'; prompt: string; expected: string; options: string[]; context: string }

export function PrecisionTrainingPanel({ article, lawName }: { article: LawArticle; lawName?: string }): JSX.Element {
  const data = useAppData()
  const navigate = useNavigate()
  const [step, setStep] = useState<PrecisionStep>(1)
  const [checkpointIndex, setCheckpointIndex] = useState(0)
  const [choice, setChoice] = useState('')
  const [orderItems, setOrderItems] = useState(() => shuffle(splitBySentence(article.text)))
  const [message, setMessage] = useState('')
  const [lastScore, setLastScore] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [startedAt, setStartedAt] = useState(Date.now())
  const mastery = data.mastery.find((item) => item.articleId === article.id)
  const numericFacts = useMemo(() => extractNumericFacts(article.text), [article.text])
  const keywordTraps = useMemo(() => extractKeywordTraps(article.text), [article.text])
  const fallbackKeywords = useMemo(() => Array.from(new Set(article.text.match(/不得|應|得/g) ?? [])), [article.text])
  const checkpoints = useMemo(() => createCheckpoints(numericFacts, keywordTraps, fallbackKeywords, article.text), [article.text, fallbackKeywords, keywordTraps, numericFacts])
  const currentCheckpoint = checkpoints[checkpointIndex]

  async function completeReading(): Promise<void> {
    setBusy(true)
    try {
      await data.markRead(article.id)
      setMessage('閱讀完成。接下來先記住這條法規的口訣與諧音。')
      setStep(2)
    } finally {
      setBusy(false)
    }
  }

  function completeMnemonic(): void {
    setMessage(checkpoints.length ? '開始確認數字與應／得／不得等高風險字眼。' : '本條沒有偵測到數字或應／得／不得，直接進入條文排序。')
    setStep(checkpoints.length ? 3 : 4)
    setStartedAt(Date.now())
  }

  async function submitCheckpoint(): Promise<void> {
    if (!currentCheckpoint || !choice) return
    setBusy(true)
    try {
      const result = await data.submitTraining({ article, mode: currentCheckpoint.kind === 'number' ? 'numbers' : 'keywords', answer: choice, originalText: article.text, comparisonText: currentCheckpoint.expected, requireExact: true, usedHints: 0, durationSeconds: Math.max(1, Math.floor((Date.now() - startedAt) / 1000)) })
      setLastScore(result.answer.score)
      setMessage(result.answer.score >= 80 ? '答對。請繼續確認下一個高風險字眼。' : `這題答案是「${currentCheckpoint.expected}」，請記住原文位置。`)
    } finally {
      setBusy(false)
    }
  }

  function nextCheckpoint(): void {
    if (checkpointIndex >= checkpoints.length - 1) {
      setStep(4)
      setChoice('')
      setLastScore(null)
      setMessage('高風險字眼確認完成，現在排序整條法規。')
      return
    }
    setCheckpointIndex((value) => value + 1)
    setChoice('')
    setLastScore(null)
    setStartedAt(Date.now())
  }

  async function submitOrdering(): Promise<void> {
    if (!orderItems.length) return
    setBusy(true)
    try {
      const result = await data.submitTraining({ article, mode: 'ordering', answer: orderItems.join(''), originalText: article.text, comparisonText: article.text, requireExact: true, usedHints: 0, durationSeconds: Math.max(1, Math.floor((Date.now() - startedAt) / 1000)) })
      setLastScore(result.answer.score)
      setMessage(result.answer.score >= 80 ? '條文順序正確，這條完成。' : '順序仍有差異，請依原文再排一次。')
    } finally {
      setBusy(false)
    }
  }

  return <div className="page-stack precision-training-page">
    <PageHeader eyebrow="PRECISION TRAINING / 精準背誦" title={`${lawName ?? '法規'} · 第 ${article.articleNumber} 條`} description="先讀全文，再記口訣，接著確認高風險字眼，最後排序條文。" actions={<Button variant="secondary" onClick={() => navigate(`/articles?law=${article.lawId}`)}>回到法條</Button>} />
    <section className="precision-steps card">{(['閱讀全文', '口訣／諧音', '數字與應得確認', '排序條文'] as const).map((label, index) => <div className={`precision-step ${step === index + 1 ? 'active' : step > index + 1 ? 'done' : ''}`} key={label}><span>0{index + 1}</span><strong>{label}</strong></div>)}</section>
    <section className="precision-reading card"><div className="precision-heading"><div><span className="eyebrow">ARTICLE / 原文</span><h2>第 {article.articleNumber} 條</h2></div>{mastery && <StatusBadge status={mastery.status} />}</div><p className="precision-article-text">{article.text}</p><div className="precision-progress"><ProgressBar value={step * 25} showValue={false} tone="gold" /><span>步驟 {step}/4 · 熟練度 {Math.round(mastery?.score ?? 0)}%</span></div></section>
    {step === 1 && <section className="precision-action card"><h2>第一步：閱讀法條</h2><p>先完整閱讀一次，建立條文的整體結構。</p><Button onClick={() => void completeReading()} disabled={busy}>{busy ? '記錄中…' : '我已閱讀完成'}</Button></section>}
    {step === 2 && <section className="precision-action card"><h2>第二步：背誦口訣／諧音</h2><div className="mnemonic-card"><span className="eyebrow">MNEMONIC / 記憶提示</span><p>{article.mnemonic?.trim() || buildMnemonic(article.text)}</p>{!article.mnemonic?.trim() && <small>可到法條編輯中補上自己的口訣或諧音。</small>}</div><Button onClick={completeMnemonic}>記住了，繼續</Button></section>}
    {step === 3 && currentCheckpoint && <section className="precision-action card"><h2>第三步：確認高風險字眼</h2><p>{currentCheckpoint.prompt}</p><div className="precision-context">{currentCheckpoint.context}</div><div className="precision-options">{currentCheckpoint.options.map((option) => <button type="button" key={option} className={choice === option ? 'selected' : ''} onClick={() => setChoice(option)} disabled={lastScore !== null}>{option}</button>)}</div>{lastScore === null ? <Button onClick={() => void submitCheckpoint()} disabled={busy || !choice}>確認答案</Button> : <div className="precision-result"><Notice tone={lastScore >= 80 ? 'success' : 'warning'}>{message}</Notice><Button onClick={nextCheckpoint}>{checkpointIndex === checkpoints.length - 1 ? '進入排序' : '下一個字眼'}</Button></div>}</section>}
    {step === 4 && <section className="precision-action card"><h2>第四步：排序條文</h2><p>依照原文順序排列下列句子，再提交確認。</p><div className="precision-order-list">{orderItems.map((item, index) => <div className="precision-order-row" key={`${item}-${index}`}><span>{index + 1}</span><p>{item}</p><button type="button" onClick={() => setOrderItems(move(orderItems, index, index - 1))} disabled={index === 0} aria-label="上移">↑</button><button type="button" onClick={() => setOrderItems(move(orderItems, index, index + 1))} disabled={index === orderItems.length - 1} aria-label="下移">↓</button></div>)}</div>{lastScore === null ? <Button onClick={() => void submitOrdering()} disabled={busy}>{busy ? '判定中…' : '提交排序'}</Button> : <div className="precision-result"><Notice tone={lastScore >= 80 ? 'success' : 'warning'}>{message}</Notice><Button onClick={() => navigate('/today')}>完成並返回今日任務</Button></div>}</section>}
    {message && step !== 3 && step !== 4 && <Notice tone="info">{message}</Notice>}
  </div>
}

function createCheckpoints(numbers: NumericFact[], keywords: KeywordTrap[], fallbackKeywords: string[], text: string): Checkpoint[] {
  const numberCheckpoints = numbers.map((fact) => ({ kind: 'number' as const, prompt: '請選出原文中這個數字／期間的正確內容。', expected: fact.answer, options: fact.options, context: `${fact.before}＿＿＿＿${fact.after}` }))
  const keywordCheckpoints = keywords.map((trap) => ({ kind: 'keyword' as const, prompt: '請選出原文中的規範字眼。', expected: trap.answer, options: trap.options, context: `${trap.before}＿＿＿＿${trap.after}` }))
  if (!keywords.length && fallbackKeywords.length) return [...numberCheckpoints, ...fallbackKeywords.map((keyword) => ({ kind: 'keyword' as const, prompt: '請選出原文中的規範字眼。', expected: keyword, options: Array.from(new Set([keyword, '應', '得', '不得'])), context: maskKeyword(text, keyword) }))]
  return [...numberCheckpoints, ...keywordCheckpoints]
}

function buildMnemonic(text: string): string {
  const numbers = text.match(/(?:\d+(?:\.\d+)?|[零一二三四五六七八九十百千萬]+)\s*(?:年|月|日|時|小時|分鐘|分|秒|元|歲)/g) ?? []
  const keywords = Array.from(new Set(text.match(/不得|應|得/g) ?? []))
  const parts = [numbers.length ? `數字：${numbers.join('、')}` : '', keywords.length ? `字眼：${keywords.join('、')}` : ''].filter(Boolean)
  return parts.length ? parts.join('｜') : '請用自己的話，把本條的主體、條件與效果濃縮成一句記憶句。'
}

function maskKeyword(text: string, keyword: string): string {
  const index = text.indexOf(keyword)
  return index < 0 ? text : `${text.slice(Math.max(0, index - 24), index)}＿＿＿＿${text.slice(index + keyword.length, index + keyword.length + 42)}`
}

function move<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length) return items
  const next = [...items]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

function shuffle<T>(items: T[]): T[] {
  const next = [...items]
  for (let index = next.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1))
    ;[next[index], next[target]] = [next[target], next[index]]
  }
  return next
}
