import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, ModeBadge, Notice, PageHeader, ProgressBar, StatusBadge } from '../components/ui'
import { useAppData } from '../context/AppContext'
import type { ComparisonResult, LawArticle, SubmissionResult, TrainingMode } from '../types'
import { splitBySentence } from '../lib/importer'
import { formatRelativeReview } from '../lib/utils'

const modes: Array<{ value: TrainingMode; label: string; description: string }> = [
  { value: 'reading', label: '閱讀模式', description: '完整閱讀原文，記錄閱讀次數，但不直接判定背熟。' },
  { value: 'cloze', label: '關鍵字填空', description: '針對法定用語與關鍵字逐格補回原文。' },
  { value: 'ordering', label: '段落排序', description: '重新排列段落，檢查項、款、目與語意順序。' },
  { value: 'prompt', label: '提示默寫', description: '選擇提示程度後，輸入完整法條；提示越多權重越低。' },
  { value: 'dictation', label: '完整默寫', description: '只顯示法規與條號，進行核心逐字驗證。' },
]

export function TrainingPage(): JSX.Element {
  const data = useAppData()
  const navigate = useNavigate()
  const { articleId } = useParams()
  const articles = data.articles.filter((article) => !article.deletedAt && data.laws.some((law) => law.id === article.lawId && !law.deletedAt))
  const [selectedId, setSelectedId] = useState(articleId ?? articles[0]?.id ?? '')
  const [mode, setMode] = useState<TrainingMode>('dictation')
  const [hintLevel, setHintLevel] = useState(0)
  const [clozeLevel, setClozeLevel] = useState<'初級' | '中級' | '高級' | '極限'>('中級')
  const [answer, setAnswer] = useState('')
  const [clozeValues, setClozeValues] = useState<Record<number, string>>({})
  const [orderItems, setOrderItems] = useState<string[]>([])
  const [result, setResult] = useState<SubmissionResult | null>(null)
  const [readMessage, setReadMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [startedAt, setStartedAt] = useState(Date.now())
  const article = articles.find((item) => item.id === selectedId)
  const law = article ? data.laws.find((item) => item.id === article.lawId) : undefined
  const mastery = article ? data.mastery.find((item) => item.articleId === article.id) : undefined
  const review = article ? data.reviews.find((item) => item.articleId === article.id) : undefined
  const modeInfo = modes.find((item) => item.value === mode) ?? modes[4]
  const clozeSegments = useMemo(() => article ? createClozeSegments(article.text, clozeLevel) : [], [article, clozeLevel])
  const sections = useMemo(() => article ? splitBySentence(article.text) : [], [article])

  useEffect(() => {
    if (articleId && articleId !== selectedId) setSelectedId(articleId)
  }, [articleId, selectedId])

  useEffect(() => {
    setAnswer(''); setClozeValues({}); setResult(null); setReadMessage(''); setStartedAt(Date.now())
    const source = article ? splitBySentence(article.text) : []
    setOrderItems(shuffle(source))
  }, [article?.id, article?.text, mode])

  function chooseArticle(id: string): void { setSelectedId(id); setResult(null); navigate(`/training/${id}`, { replace: true }) }

  async function submit(): Promise<void> {
    if (!article) return
    if (mode === 'reading') {
      setBusy(true)
      try { await data.markRead(article.id, Math.floor((Date.now() - startedAt) / 1000)); setReadMessage(`已記錄閱讀一次。閱讀紀錄不會直接判定為背熟。`) } catch (error) { setReadMessage(error instanceof Error ? error.message : '閱讀紀錄儲存失敗。') } finally { setBusy(false) }
      return
    }
    const userAnswer = mode === 'cloze' ? clozeSegments.map((segment, index) => segment.hidden ? clozeValues[index] ?? '' : segment.value).join('') : mode === 'ordering' ? orderItems.join('') : answer
    if (!userAnswer.trim()) { setReadMessage('請先完成作答再送出。'); return }
    setBusy(true); setReadMessage('')
    try {
      const submission = await data.submitTraining({ article, mode, answer: userAnswer, usedHints: mode === 'prompt' ? hintLevel : 0, durationSeconds: Math.max(1, Math.floor((Date.now() - startedAt) / 1000)) })
      setResult(submission)
    } catch (error) { setReadMessage(error instanceof Error ? error.message : '作答儲存失敗。') } finally { setBusy(false) }
  }

  function nextArticle(): void {
    if (!article || !articles.length) return
    const next = articles[(articles.findIndex((item) => item.id === article.id) + 1) % articles.length]
    chooseArticle(next.id)
  }

  if (!articles.length || !article) return <div className="page-stack"><PageHeader eyebrow="TRAINING / 訓練模式" title="開始訓練" description="請先匯入至少一條已校對的法條原文。" /><div className="empty-state card"><div className="empty-icon">✦</div><h3>尚無可訓練法條</h3><p>法條資料會留在本機 IndexedDB，不需要登入或網路。</p><Button onClick={() => navigate('/articles')}>前往法條瀏覽</Button></div></div>

  return <div className="page-stack training-page">
    <PageHeader eyebrow="TRAINING / 訓練模式" title="精準背誦訓練" description="每次作答都會留下逐字比對、錯題、熟練度與下一次複習日期。" actions={<Button variant="secondary" onClick={() => navigate('/today')}>今日任務</Button>} />
    <section className="training-toolbar card"><label className="training-article-select"><span>目前法條</span><select value={selectedId} onChange={(event) => chooseArticle(event.target.value)}>{articles.map((item) => { const itemLaw = data.laws.find((lawItem) => lawItem.id === item.lawId); return <option value={item.id} key={item.id}>{itemLaw?.shortName ?? itemLaw?.name} · 第 {item.articleNumber} 條</option> })}</select></label><div className="training-metadata">{mastery && <StatusBadge status={mastery.status} />}<span>熟練度 {Math.round(mastery?.score ?? 0)}%</span>{review && <span>下次：{formatRelativeReview(review.nextReviewAt)}</span>}</div></section>
    <section className="mode-tabs">{modes.map((item) => <button key={item.value} className={mode === item.value ? 'active' : ''} onClick={() => setMode(item.value)}><span className="mode-tab-number">{String(modes.findIndex((modeItem) => modeItem.value === item.value) + 1).padStart(2, '0')}</span><strong>{item.label}</strong><small>{item.value === 'dictation' ? '核心驗證' : item.value === 'surprise' ? '隨機抽考' : item.value === 'reading' ? '建立記憶' : '強化回憶'}</small></button>)}</section>
    <section className="training-layout"><div className="training-main card"><div className="training-card-heading"><div><div className="training-label"><ModeBadge mode={mode} /><span>{modeInfo.description}</span></div><h2>{law?.name ?? '未知法規'} <span>· 第 {article.articleNumber} 條</span></h2>{article.title && <p className="muted">{article.title}</p>}</div><div className="timer-badge">◷ 進行中</div></div>{mode === 'reading' && <ReadingPanel article={article} fontScale={data.settings.fontScale} onIncrease={() => void data.updateSettings({ fontScale: Math.min(1.35, data.settings.fontScale + 0.05) })} onDecrease={() => void data.updateSettings({ fontScale: Math.max(0.85, data.settings.fontScale - 0.05) })} />}{mode === 'cloze' && <ClozePanel segments={clozeSegments} values={clozeValues} level={clozeLevel} onLevelChange={setClozeLevel} onChange={(index, value) => setClozeValues((current) => ({ ...current, [index]: value }))} />}{mode === 'ordering' && <OrderingPanel items={orderItems} onMove={(from, to) => setOrderItems(moveItem(orderItems, from, to))} />}{mode === 'prompt' && <DictationPanel article={article} answer={answer} onAnswer={setAnswer} hintLevel={hintLevel} onHintLevel={setHintLevel} prompt />}{mode === 'dictation' && <DictationPanel article={article} answer={answer} onAnswer={setAnswer} hintLevel={0} onHintLevel={() => undefined} />}{readMessage && <Notice tone={readMessage.includes('失敗') || readMessage.includes('請先') ? 'warning' : 'success'}>{readMessage}</Notice>}{result && <ResultPanel result={result} /> }<div className="training-submit-row"><span className="muted">答題時間會在送出時記錄</span><div><Button variant="ghost" onClick={() => { setAnswer(''); setResult(null); setStartedAt(Date.now()) }}>重新開始</Button><Button onClick={() => void submit()} disabled={busy}>{busy ? '儲存中…' : mode === 'reading' ? '我已閱讀' : '送出並查看比對'}</Button></div></div></div><aside className="training-side"><div className="card side-status-card"><p className="eyebrow">ARTICLE STATUS</p><div className="side-score"><strong>{Math.round(mastery?.score ?? 0)}</strong><span>/ 100</span></div><ProgressBar value={mastery?.score ?? 0} label="累積熟練度" tone={(mastery?.score ?? 0) >= 80 ? 'green' : 'gold'} /><div className="side-stat-list"><div><span>連續答對</span><strong>{mastery?.consecutiveCorrect ?? 0} 次</strong></div><div><span>跨日答對</span><strong>{mastery?.crossDayPasses ?? 0} 天</strong></div><div><span>完整默寫日</span><strong>{mastery?.fullDictationDates.length ?? 0} 日</strong></div><div><span>下次複習</span><strong>{review ? formatRelativeReview(review.nextReviewAt) : '送出後安排'}</strong></div></div></div><div className="card training-tip"><p className="eyebrow">PRECISION NOTE</p><h3>逐字驗證的核心</h3><p>系統會把「得、應、不得、於、及、或、與、之、其」等高權重詞彙列入額外檢查。單次高分不會直接標記為精通。</p><div className="tip-line"><span /> 三個不同日期 + 連續三次 95 分以上，才有機會進入精通判定。</div></div>{result?.unlockedAchievements.length ? <div className="card achievement-toast"><span>♜</span><div><strong>解鎖成就</strong>{result.unlockedAchievements.map((item) => <p key={item.key}>{item.title}</p>)}</div></div> : null}</aside></section>{result && <div className="after-result-actions"><Button variant="secondary" onClick={nextArticle}>下一條法條 →</Button><Button variant="ghost" onClick={() => navigate('/records')}>查看學習紀錄</Button></div>}
  </div>
}

function ReadingPanel({ article, fontScale, onIncrease, onDecrease }: { article: LawArticle; fontScale: number; onIncrease: () => void; onDecrease: () => void }): JSX.Element {
  return <div className="reading-panel"><div className="reading-controls"><span>閱讀字級</span><Button variant="ghost" onClick={onDecrease}>A−</Button><strong>{Math.round(fontScale * 100)}%</strong><Button variant="ghost" onClick={onIncrease}>A＋</Button></div><p className="article-original large" style={{ fontSize: `${fontScale}rem` }}>{article.text}</p><Notice tone="info">閱讀完成只會記錄閱讀次數與時間，不會直接增加完整默寫熟練度。</Notice></div>
}

interface ClozeSegment { value: string; hidden: boolean }

function ClozePanel({ segments, values, level, onLevelChange, onChange }: { segments: ClozeSegment[]; values: Record<number, string>; level: string; onLevelChange: (level: '初級' | '中級' | '高級' | '極限') => void; onChange: (index: number, value: string) => void }): JSX.Element {
  return <div className="cloze-panel"><div className="cloze-toolbar"><span>隱藏程度</span>{(['初級', '中級', '高級', '極限'] as const).map((item) => <button key={item} className={level === item ? 'active' : ''} onClick={() => onLevelChange(item)}>{item}</button>)}</div><div className="cloze-text">{segments.map((segment, index) => segment.hidden ? <input key={index} className="cloze-input" value={values[index] ?? ''} maxLength={1} aria-label={`第 ${index + 1} 個填空`} onChange={(event) => onChange(index, event.target.value)} /> : <span key={index}>{segment.value}</span>)}</div><p className="muted">優先隱藏法律效果、要件、數字與高權重用語；每格填入一個字。</p></div>
}

function OrderingPanel({ items, onMove }: { items: string[]; onMove: (from: number, to: number) => void }): JSX.Element {
  return <div className="ordering-panel"><Notice tone="info">請用每段右側的箭頭調整順序；手機上以按鈕操作較穩定，也支援觸控裝置。</Notice><div className="ordering-list">{items.map((item, index) => <div className="ordering-item" draggable onDragStart={(event) => event.dataTransfer.setData('text/plain', String(index))} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { const from = Number(event.dataTransfer.getData('text/plain')); if (Number.isInteger(from)) onMove(from, index) }} key={`${item}-${index}`}><span className="drag-handle">⠿</span><span className="order-number">{index + 1}</span><p>{item}</p><div className="order-buttons"><button disabled={index === 0} onClick={() => onMove(index, index - 1)} aria-label="上移">↑</button><button disabled={index === items.length - 1} onClick={() => onMove(index, index + 1)} aria-label="下移">↓</button></div></div>)}</div></div>
}

function DictationPanel({ article, answer, onAnswer, hintLevel, onHintLevel, prompt = false }: { article: LawArticle; answer: string; onAnswer: (value: string) => void; hintLevel: number; onHintLevel: (value: number) => void; prompt?: boolean }): JSX.Element {
  const prompts = getPrompts(article.text)
  return <div className="dictation-panel">{prompt && <div className="hint-levels"><span>提示級別</span>{[0, 1, 2, 3, 4].map((level) => <button className={hintLevel === level ? 'active' : ''} key={level} onClick={() => onHintLevel(level)}>{level === 0 ? '不提示' : `第 ${level} 級`}</button>)}</div>}{prompt && hintLevel > 0 && <div className="hint-box"><span>提示</span><p>{prompts[hintLevel - 1]}</p></div>}<div className="dictation-prompt"><span>{prompt && hintLevel ? '請依提示輸入完整法條' : '請輸入完整法條原文'}</span><strong>{article.mustMemorize ? '必背法條' : '一般法條'}</strong></div><textarea className="dictation-textarea" value={answer} onChange={(event) => onAnswer(event.target.value)} placeholder="在此輸入你的默寫內容…" rows={12} autoFocus /></div>
}

function ResultPanel({ result }: { result: SubmissionResult }): JSX.Element {
  const comparison = result.answer.comparison
  return <div className="result-panel"><div className="result-hero"><div><span className="eyebrow">RESULT / 作答結果</span><h3>{result.answer.score >= 95 ? '精準命中' : result.answer.score >= 80 ? '持續修正' : '需要重新學習'}</h3></div><div className={`result-score grade-${comparison.grade}`}><strong>{Math.round(result.answer.score)}</strong><span>{comparison.grade} 級</span></div></div><div className="result-metrics"><div><span>逐字正確率</span><strong>{Math.round(comparison.accuracy)}%</strong></div><div><span>關鍵字正確率</span><strong>{Math.round(comparison.keywordAccuracy)}%</strong></div><div><span>結構正確率</span><strong>{Math.round(comparison.structureAccuracy)}%</strong></div><div><span>下次複習</span><strong>{formatRelativeReview(result.review.nextReviewAt)}</strong></div></div><ComparisonView comparison={comparison} />{comparison.errors.length ? <div className="error-list"><h4>需要修正的地方 <span>{comparison.errors.length}</span></h4>{comparison.errors.slice(0, 12).map((error, index) => <div className={`error-item ${error.isHighWeight ? 'high-weight' : ''}`} key={`${error.kind}-${index}`}><span>{error.isHighWeight ? '高權重' : error.kind === 'missing' ? '漏字' : error.kind === 'extra' ? '多字' : error.kind === 'structure' ? '結構' : '錯字'}</span><p>{error.message}</p></div>)}</div> : <Notice tone="success">沒有偵測到錯字、漏字、多字或結構錯誤。</Notice>}</div>
}

function ComparisonView({ comparison }: { comparison: ComparisonResult }): JSX.Element {
  return <div className="comparison-view"><div className="comparison-legend"><span className="legend-equal">正確</span><span className="legend-missing">漏字</span><span className="legend-extra">多字</span><span className="legend-replace">錯字</span></div><div className="comparison-line"><span className="comparison-label">你的答案</span><p>{comparison.parts.map((part, index) => part.type === 'equal' ? <span key={index} className="diff-equal">{part.actual}</span> : part.type === 'extra' ? <span key={index} className="diff-extra">{part.actual}</span> : part.type === 'replacement' ? <span key={index} className="diff-replace">{part.actual}<small>應為 {part.expected}</small></span> : <span key={index} className="diff-missing">{part.expected}<small>漏寫</small></span>)}</p></div><details><summary>查看原文</summary><p className="comparison-original">{comparison.expected}</p></details></div>
}

function createClozeSegments(text: string, level: string): ClozeSegment[] {
  const ratio: Record<string, number> = { 初級: 0.2, 中級: 0.4, 高級: 0.6, 極限: 0.8 }
  const hiddenTarget = Math.max(1, Math.floor(text.length * (ratio[level] ?? 0.4)))
  const priority = ['不得', '應即', '必要時', '法定期間', '得', '應', '於', '及', '或', '與', '之', '其']
  const hidden = new Set<number>()
  for (const keyword of priority) {
    let start = 0
    while (start < text.length && hidden.size < hiddenTarget) {
      const found = text.indexOf(keyword, start)
      if (found < 0) break
      for (let index = found; index < Math.min(text.length, found + keyword.length); index += 1) hidden.add(index)
      start = found + keyword.length
    }
  }
  for (let index = 0; index < text.length && hidden.size < hiddenTarget; index += 1) if (!/[，。！？；：、\s]/.test(text[index])) hidden.add(index)
  return Array.from(text).map((value, index) => ({ value, hidden: hidden.has(index) }))
}

function getPrompts(text: string): string[] {
  const segments = splitBySentence(text)
  const firstCharacters = segments.map((segment) => segment[0] ?? '').join('、')
  return [firstCharacters || '每句首字提示', segments[0]?.slice(0, 24) ?? '第一段提示', segments.map((segment, index) => `第${index + 1}段`).join('、') || '段落架構提示', '僅顯示法規名稱與條號']
}

function shuffle(items: string[]): string[] {
  if (items.length < 2) return items
  const offset = Math.max(1, Math.floor(items.length / 2))
  return items.slice(offset).concat(items.slice(0, offset))
}

function moveItem(items: string[], from: number, to: number): string[] {
  if (from < 0 || to < 0 || from >= items.length || to >= items.length) return items
  const next = [...items]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}
