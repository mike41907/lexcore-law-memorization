import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button, ModeBadge, Notice, PageHeader, ProgressBar, StatusBadge } from '../components/ui'
import { useAppData } from '../context/AppContext'
import type { ComparisonResult, LawArticle, SubmissionResult, TrainingMode } from '../types'
import { splitBySentence } from '../lib/importer'
import { extractNumericFacts, type NumericFact } from '../lib/numericTraining'
import { createLegalQuizQuestions, type LegalQuizQuestion } from '../lib/legalQuiz'
import { extractKeywordTraps, type KeywordTrap } from '../lib/keywordTraining'
import { formatRelativeReview } from '../lib/utils'

const modes: Array<{ value: TrainingMode; label: string; description: string }> = [
  { value: 'reading', label: '01 全文閱讀', description: '先完整閱讀原文，建立條文的整體架構。' },
  { value: 'comprehension', label: '02 要件／效果／刑罰', description: '選擇題確認構成要件、法律效果與刑罰。' },
  { value: 'ordering', label: '03 段落排序', description: '重新排列段落，檢查項、款、目與語意順序。' },
  { value: 'numbers', label: '04 數字陷阱', description: '專攻刑度、期間、年齡、金額、比例與次數。' },
  { value: 'keywords', label: '05 應／得陷阱', description: '辨識應、得、不得、應即等容易混淆的法定用語。' },
]

export function TrainingPage(): JSX.Element {
  const data = useAppData()
  const navigate = useNavigate()
  const { articleId } = useParams()
  const articles = useMemo(() => {
    const activeLawIds = new Set(data.laws.filter((law) => !law.deletedAt).map((law) => law.id))
    return data.articles.filter((article) => !article.deletedAt && activeLawIds.has(article.lawId))
  }, [data.articles, data.laws])
  const numericRows = useMemo(() => articles
    .map((item) => ({ article: item, facts: extractNumericFacts(item.text) }))
    .filter((row) => row.facts.length > 0), [articles])
  const numericFactCount = useMemo(() => numericRows.reduce((sum, row) => sum + row.facts.length, 0), [numericRows])
  const [selectedId, setSelectedId] = useState(articleId ?? articles[0]?.id ?? '')
  const [mode, setMode] = useState<TrainingMode>('reading')
  const [answer, setAnswer] = useState('')
  const [orderItems, setOrderItems] = useState<string[]>([])
  const [numericFactIndex, setNumericFactIndex] = useState(0)
  const [numericChoice, setNumericChoice] = useState('')
  const [legalQuestionIndex, setLegalQuestionIndex] = useState(0)
  const [legalChoice, setLegalChoice] = useState('')
  const [keywordIndex, setKeywordIndex] = useState(0)
  const [keywordChoice, setKeywordChoice] = useState('')
  const [result, setResult] = useState<SubmissionResult | null>(null)
  const [readMessage, setReadMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [startedAt, setStartedAt] = useState(Date.now())

  const article = articles.find((item) => item.id === selectedId)
  const law = article ? data.laws.find((item) => item.id === article.lawId) : undefined
  const mastery = article ? data.mastery.find((item) => item.articleId === article.id) : undefined
  const review = article ? data.reviews.find((item) => item.articleId === article.id) : undefined
  const modeInfo = modes.find((item) => item.value === mode) ?? modes[modes.length - 1]
  const legalQuestions = useMemo(() => article ? createLegalQuizQuestions(article.text, articles.map((item) => item.text)) : [], [article, articles])
  const numericFacts = numericRows.find((row) => row.article.id === article?.id)?.facts ?? []
  const numericFact = numericFacts[numericFactIndex]
  const keywordTraps = useMemo(() => article ? extractKeywordTraps(article.text) : [], [article])
  const keywordTrap = keywordTraps[keywordIndex]
  const legalQuestion = legalQuestions[legalQuestionIndex]
  const selectableArticles = mode === 'numbers' ? numericRows.map((row) => row.article) : mode === 'keywords' ? articles.filter((item) => extractKeywordTraps(item.text).length > 0) : articles

  useEffect(() => {
    if (articleId && articleId !== selectedId) setSelectedId(articleId)
  }, [articleId, selectedId])

  useEffect(() => {
    if (!articles.some((item) => item.id === selectedId) && articles[0]) setSelectedId(articles[0].id)
  }, [articles, selectedId])

  useEffect(() => {
    setAnswer('')
    setResult(null)
    setReadMessage('')
    setNumericFactIndex(0)
    setNumericChoice('')
    setLegalQuestionIndex(0)
    setLegalChoice('')
    setKeywordIndex(0)
    setKeywordChoice('')
    setStartedAt(Date.now())
    setOrderItems(shuffle(article ? splitBySentence(article.text) : []))
  }, [article?.id, article?.text, mode])

  function chooseArticle(id: string): void {
    setSelectedId(id)
    setResult(null)
    setReadMessage('')
    navigate(`/training/${id}`, { replace: true })
  }

  function chooseMode(nextMode: TrainingMode): void {
    setMode(nextMode)
    if (nextMode === 'numbers' && !numericRows.some((row) => row.article.id === selectedId) && numericRows[0]) {
      chooseArticle(numericRows[0].article.id)
    }
    if (nextMode === 'keywords') {
      const firstKeywordArticle = articles.find((item) => extractKeywordTraps(item.text).length > 0)
      if (firstKeywordArticle && !extractKeywordTraps(article?.text ?? '').length) chooseArticle(firstKeywordArticle.id)
    }
  }

  async function submit(): Promise<void> {
    if (!article) return
    if (mode === 'reading') {
      setBusy(true)
      try {
        await data.markRead(article.id, Math.floor((Date.now() - startedAt) / 1000))
        setReadMessage('已記錄閱讀一次，接下來進入構成要件、法律效果與刑罰選擇題。')
        setMode('comprehension')
      } catch (error) {
        setReadMessage(error instanceof Error ? error.message : '閱讀紀錄儲存失敗。')
      } finally {
        setBusy(false)
      }
      return
    }

    const userAnswer = mode === 'numbers'
      ? numericChoice
      : mode === 'comprehension'
        ? legalChoice
        : mode === 'keywords'
          ? keywordChoice
        : mode === 'ordering'
          ? orderItems.join('')
          : answer
    if (!userAnswer.trim()) {
      setReadMessage(mode === 'numbers' || mode === 'comprehension' || mode === 'keywords' ? '請先選擇一個答案。' : '請先完成作答再送出。')
      return
    }
    if (mode === 'numbers' && !numericFact) {
      setReadMessage('這條法條沒有可抽考的數字，請改選其他法條。')
      return
    }
    if (mode === 'comprehension' && !legalQuestion) {
      setReadMessage('這條法條目前沒有可分析的理解題。')
      return
    }
    if (mode === 'keywords' && !keywordTrap) {
      setReadMessage('這條法條目前沒有可抽考的應／得用語。')
      return
    }

    setBusy(true)
    setReadMessage('')
    try {
      const submission = await data.submitTraining({
        article,
        mode,
        answer: userAnswer,
        usedHints: 0,
        durationSeconds: Math.max(1, Math.floor((Date.now() - startedAt) / 1000)),
        originalText: mode === 'numbers' || mode === 'comprehension' || mode === 'keywords' ? article.text : undefined,
        comparisonText: mode === 'numbers' ? numericFact?.answer : mode === 'comprehension' ? legalQuestion?.correct : mode === 'keywords' ? keywordTrap?.answer : undefined,
        requireExact: mode === 'numbers' || mode === 'comprehension' || mode === 'keywords',
      })
      setResult(submission)
    } catch (error) {
      setReadMessage(error instanceof Error ? error.message : '作答儲存失敗。')
    } finally {
      setBusy(false)
    }
  }

  function resetAttempt(): void {
    setAnswer('')
    setNumericChoice('')
    setLegalChoice('')
    setKeywordChoice('')
    setResult(null)
    setReadMessage('')
    setStartedAt(Date.now())
    setOrderItems(shuffle(article ? splitBySentence(article.text) : []))
  }

  function nextArticle(): void {
    if (!article || !articles.length) return
    const next = articles[(articles.findIndex((item) => item.id === article.id) + 1) % articles.length]
    setMode('reading')
    chooseArticle(next.id)
  }

  function nextNumericQuestion(): void {
    if (!article || !numericRows.length) return
    if (numericFactIndex < numericFacts.length - 1) {
      setNumericFactIndex((current) => current + 1)
      resetAttempt()
      return
    }
    if (keywordTraps.length) {
      setMode('keywords')
      resetAttempt()
      return
    }
    nextArticle()
  }

  function nextComprehensionQuestion(): void {
    if (legalQuestionIndex < legalQuestions.length - 1) {
      setLegalQuestionIndex((current) => current + 1)
      resetAttempt()
      return
    }
    setMode('ordering')
    resetAttempt()
  }

  function nextOrderingStep(): void {
    if (numericFacts.length) setMode('numbers')
    else if (keywordTraps.length) setMode('keywords')
    else nextArticle()
    resetAttempt()
  }

  function nextKeywordQuestion(): void {
    if (keywordIndex < keywordTraps.length - 1) {
      setKeywordIndex((current) => current + 1)
      resetAttempt()
      return
    }
    nextArticle()
  }

  if (!articles.length || !article) {
    return <div className="page-stack"><PageHeader eyebrow="TRAINING / 訓練模式" title="開始訓練" description="請先匯入至少一條已校對的法條原文。" /><div className="empty-state card"><div className="empty-icon">✦</div><h3>尚無可訓練法條</h3><p>法條資料會留在本機 IndexedDB，不需要登入或網路。</p><Button onClick={() => navigate('/articles')}>前往法條瀏覽</Button></div></div>
  }

  return <div className="page-stack training-page">
    <PageHeader eyebrow="TRAINING / 訓練模式" title="精準背誦訓練" description="依序完成全文閱讀、要件／效果／刑罰選擇題、段落排序、數字陷阱與應／得用語陷阱。" actions={<Button variant="secondary" onClick={() => navigate('/today')}>今日任務</Button>} />

    <section className="training-toolbar card">
      <label className="training-article-select">
        <span>{mode === 'numbers' ? '數字題庫法條' : mode === 'keywords' ? '應／得題庫法條' : '目前法條'}</span>
        <select value={selectedId} onChange={(event) => chooseArticle(event.target.value)}>
          {selectableArticles.map((item) => {
            const itemLaw = data.laws.find((lawItem) => lawItem.id === item.lawId)
            const factCount = mode === 'numbers' ? numericRows.find((row) => row.article.id === item.id)?.facts.length ?? 0 : 0
            return <option value={item.id} key={item.id}>{itemLaw?.shortName ?? itemLaw?.name} · 第 {item.articleNumber} 條{mode === 'numbers' ? `（${factCount} 題）` : ''}</option>
          })}
        </select>
      </label>
      <div className="training-metadata">
        {mastery && <StatusBadge status={mastery.status} />}
        {mode === 'numbers' ? <span>數字題庫 {numericRows.length} 條／{numericFactCount} 題</span> : mode === 'keywords' ? <span>應／得題庫 {selectableArticles.length} 條</span> : <span>熟練度 {Math.round(mastery?.score ?? 0)}%</span>}
        {review && <span>下次：{formatRelativeReview(review.nextReviewAt)}</span>}
      </div>
    </section>

    <section className="mode-tabs">
      {modes.map((item, index) => <button key={item.value} className={mode === item.value ? 'active' : ''} onClick={() => chooseMode(item.value)}><span className="mode-tab-number">{String(index + 1).padStart(2, '0')}</span><strong>{item.label}</strong><small>{modeCaption(item.value)}</small></button>)}
    </section>

    <section className="training-layout">
      <div className="training-main card">
        <div className="training-card-heading">
          <div>
            <div className="training-label"><ModeBadge mode={mode} /><span>{modeInfo.description}</span></div>
            <h2>{law?.name ?? '未知法規'} <span>· 第 {article.articleNumber} 條</span></h2>
            {article.title && <p className="muted">{article.title}</p>}
          </div>
          <div className="timer-badge">◷ 進行中</div>
        </div>

        {mode === 'reading' && <ReadingPanel article={article} fontScale={data.settings.fontScale} onIncrease={() => void data.updateSettings({ fontScale: Math.min(1.35, data.settings.fontScale + 0.05) })} onDecrease={() => void data.updateSettings({ fontScale: Math.max(0.85, data.settings.fontScale - 0.05) })} />}
        {mode === 'numbers' && <NumericTrapPanel fact={numericFact} index={numericFactIndex} total={numericFacts.length} choice={numericChoice} onChoose={setNumericChoice} result={result} />}
        {mode === 'comprehension' && <ComprehensionPanel question={legalQuestion} choice={legalChoice} onChoose={setLegalChoice} result={result} />}
        {mode === 'ordering' && <OrderingPanel items={orderItems} onMove={(from, to) => setOrderItems(moveItem(orderItems, from, to))} />}
        {mode === 'keywords' && <KeywordTrapPanel trap={keywordTrap} index={keywordIndex} total={keywordTraps.length} choice={keywordChoice} onChoose={setKeywordChoice} result={result} />}

        {readMessage && <Notice tone={readMessage.includes('失敗') || readMessage.includes('請先') || readMessage.includes('沒有') ? 'warning' : 'success'}>{readMessage}</Notice>}
        {result && mode !== 'numbers' && mode !== 'comprehension' && mode !== 'keywords' && <ResultPanel result={result} />}

        <div className="training-submit-row">
          <span className="muted">{mode === 'reading' ? '閱讀完成後會自動進入理解題' : mode === 'numbers' ? '只要數字不完全相同，本題即為 0 分並進入錯題複習' : mode === 'keywords' ? '應、得、不得、應即只要選錯一字，就會進入錯題複習' : '答題時間會在送出時記錄'}</span>
          <div>
            <Button variant="ghost" onClick={resetAttempt}>{result ? '重做本題' : '重新開始'}</Button>
            <Button onClick={() => mode === 'numbers' && result ? nextNumericQuestion() : mode === 'comprehension' && result ? nextComprehensionQuestion() : mode === 'ordering' && result ? nextOrderingStep() : mode === 'keywords' && result ? nextKeywordQuestion() : void submit()} disabled={busy || mode === 'numbers' && !numericFact || mode === 'comprehension' && !legalQuestion || mode === 'keywords' && !keywordTrap}>{busy ? '儲存中…' : mode === 'numbers' ? result ? '下一題 →' : '鎖定數字' : mode === 'comprehension' ? result ? legalQuestionIndex === legalQuestions.length - 1 ? '進入段落排序 →' : '下一題 →' : '確認選項' : mode === 'ordering' ? result ? '進入下一階段 →' : '送出排序' : mode === 'keywords' ? result ? keywordIndex === keywordTraps.length - 1 ? '完成本條 →' : '下一題 →' : '鎖定用語' : mode === 'reading' ? '我已閱讀' : '送出'}</Button>
          </div>
        </div>
      </div>

      <aside className="training-side">
        <div className="card side-status-card">
          <p className="eyebrow">ARTICLE STATUS</p>
          <div className="side-score"><strong>{Math.round(mastery?.score ?? 0)}</strong><span>/ 100</span></div>
          <ProgressBar value={mastery?.score ?? 0} label="累積熟練度" tone={(mastery?.score ?? 0) >= 80 ? 'green' : 'gold'} />
          <div className="side-stat-list">
            {mode === 'comprehension' && <div><span>理解題進度</span><strong>{legalQuestions.length ? legalQuestionIndex + 1 : 0} / {legalQuestions.length}</strong></div>}
            {mode === 'numbers' && <div><span>本條數字題</span><strong>{numericFacts.length} 題</strong></div>}
            {mode === 'numbers' && <div><span>目前進度</span><strong>{numericFacts.length ? numericFactIndex + 1 : 0} / {numericFacts.length}</strong></div>}
            {mode === 'keywords' && <div><span>應／得題進度</span><strong>{keywordTraps.length ? keywordIndex + 1 : 0} / {keywordTraps.length}</strong></div>}
            <div><span>連續答對</span><strong>{mastery?.consecutiveCorrect ?? 0} 次</strong></div>
            <div><span>跨日答對</span><strong>{mastery?.crossDayPasses ?? 0} 天</strong></div>
            <div><span>核心高分日</span><strong>{mastery?.fullDictationDates.length ?? 0} 日</strong></div>
            <div><span>下次複習</span><strong>{review ? formatRelativeReview(review.nextReviewAt) : '送出後安排'}</strong></div>
          </div>
        </div>

        <div className="card training-tip">
          <p className="eyebrow">PRECISION NOTE</p>
          {mode === 'numbers' ? <><h3>數字不能只靠印象</h3><p>選項會維持相同單位，優先混入同條與常考的相近門檻，例如三年／五年、二月／三月、二十四／四十八小時。</p><div className="tip-line"><span /> 答錯會保留法規、條號、完整原文與你誤選的數字，並排入下一次複習。</div></> : mode === 'keywords' ? <><h3>應與得不能憑印象</h3><p>題目會保留原文前後語境，只替換「應、得、不得、應即」等關鍵字，訓練你辨識法律義務與裁量。</p><div className="tip-line"><span /> 只差一個字也會判定錯誤。</div></> : mode === 'comprehension' ? <><h3>先懂再背</h3><p>先回答構成要件、法律效果與刑罰，確認條文在處理什麼問題，再進入排序與數字訓練。</p><div className="tip-line"><span /> 每一題的正解都取自本條或官方匯入原文。</div></> : <><h3>先建立條文架構</h3><p>完整閱讀後依序完成理解題、排序與陷阱題，不要求你在一開始就硬背全文。</p><div className="tip-line"><span /> 核心高分與跨日複習會累積熟練度。</div></>}
        </div>

        {result?.unlockedAchievements.length ? <div className="card achievement-toast"><span>♜</span><div><strong>解鎖成就</strong>{result.unlockedAchievements.map((item) => <p key={item.key}>{item.title}</p>)}</div></div> : null}
      </aside>
    </section>

    {result && mode !== 'numbers' && mode !== 'comprehension' && mode !== 'keywords' && <div className="after-result-actions"><Button variant="secondary" onClick={nextArticle}>下一條法條 →</Button><Button variant="ghost" onClick={() => navigate('/records')}>查看學習紀錄</Button></div>}
  </div>
}

function ComprehensionPanel({ question, choice, onChoose, result }: { question?: LegalQuizQuestion; choice: string; onChoose: (value: string) => void; result: SubmissionResult | null }): JSX.Element {
  if (!question) return <div className="comprehension-panel"><Notice tone="warning">這條法條目前沒有可分析的構成要件、法律效果或刑罰題。</Notice></div>
  const correct = Boolean(result && choice === question.correct)
  return <div className="comprehension-panel">
    <div className="comprehension-heading"><span className="numeric-category">{question.kind}</span><strong>{question.prompt}</strong></div>
    <div className="comprehension-options" role="radiogroup" aria-label={`${question.kind}答案選項`}>
      {question.options.map((option, index) => {
        const state = result ? option === question.correct ? 'correct' : option === choice ? 'wrong' : '' : option === choice ? 'selected' : ''
        return <button type="button" role="radio" aria-checked={option === choice} className={`comprehension-option ${state}`} disabled={Boolean(result)} onClick={() => onChoose(option)} key={`${option}-${index}`}><span>{String.fromCharCode(65 + index)}</span><strong>{option}</strong></button>
      })}
    </div>
    {result && <div className={`comprehension-feedback ${correct ? 'correct' : 'wrong'}`}><strong>{correct ? '回答正確' : '需要回看原文'}</strong><p>{correct ? question.explanation : `正確內容是：「${question.correct}」`}</p></div>}
  </div>
}

function KeywordTrapPanel({ trap, index, total, choice, onChoose, result }: { trap?: KeywordTrap; index: number; total: number; choice: string; onChoose: (value: string) => void; result: SubmissionResult | null }): JSX.Element {
  if (!trap) return <div className="keyword-panel"><Notice tone="warning">這條法條目前沒有可抽考的「應／得」用語。</Notice></div>
  const correct = Boolean(result && choice === trap.answer)
  return <div className="keyword-panel">
    <div className="numeric-toolbar"><span className="numeric-category">應／得陷阱</span><strong>本條第 {index + 1} / {total} 題</strong></div>
    <div className="numeric-instruction"><span>請選出原文中的正確法定用語</span><small>只差一字也會判錯</small></div>
    <p className="keyword-question">{trap.before}<mark>［？］</mark>{trap.after}</p>
    <div className="numeric-options" role="radiogroup" aria-label="應得用語答案選項">
      {trap.options.map((option, optionIndex) => {
        const state = result ? option === trap.answer ? 'correct' : option === choice ? 'wrong' : '' : option === choice ? 'selected' : ''
        return <button type="button" role="radio" aria-checked={option === choice} className={state} disabled={Boolean(result)} onClick={() => onChoose(option)} key={option}><span>{String.fromCharCode(65 + optionIndex)}</span><strong>{option}</strong></button>
      })}
    </div>
    {result && <div className={`numeric-feedback ${correct ? 'correct' : 'wrong'}`}><div><span>{correct ? '✓' : '!'}</span><div><strong>{correct ? '用語命中：100 分' : '用語誤植：0 分'}</strong><p>{correct ? `原文使用「${trap.answer}」。` : `你選「${choice}」，原文是「${trap.answer}」。`}</p></div></div><details><summary>查看完整語境</summary><p>{trap.context}</p></details></div>}
  </div>
}

function NumericTrapPanel({ fact, index, total, choice, onChoose, result }: { fact?: NumericFact; index: number; total: number; choice: string; onChoose: (value: string) => void; result: SubmissionResult | null }): JSX.Element {
  if (!fact) return <div className="numeric-panel"><Notice tone="warning">這條法條沒有刑度、期間、年齡、金額、比例或次數可供抽考。</Notice></div>
  const correct = Boolean(result && choice === fact.answer)
  return <div className="numeric-panel">
    <div className="numeric-toolbar"><span className="numeric-category">{fact.category}</span><strong>本條第 {index + 1} / {total} 題</strong></div>
    <div className="numeric-instruction"><span>請選出空格中的精確法定數字</span><small>選項保留原單位，錯一字即判錯</small></div>
    <p className="numeric-question">{fact.before}<mark aria-label="待作答數字">［？］</mark>{fact.after}</p>
    <div className="numeric-options" role="radiogroup" aria-label="數字答案選項">
      {fact.options.map((option, optionIndex) => {
        const state = result
          ? option === fact.answer ? 'correct' : option === choice ? 'wrong' : ''
          : option === choice ? 'selected' : ''
        return <button type="button" role="radio" aria-checked={option === choice} className={state} disabled={Boolean(result)} onClick={() => onChoose(option)} key={option}><span>{String.fromCharCode(65 + optionIndex)}</span><strong>{option}</strong></button>
      })}
    </div>
    {result && <div className={`numeric-feedback ${correct ? 'correct' : 'wrong'}`}><div><span>{correct ? '✓' : '!'}</span><div><strong>{correct ? '精準命中：100 分' : '數字誤植：0 分'}</strong><p>{correct ? `答案確實是「${fact.answer}」。` : `你選「${choice}」，正確答案是「${fact.answer}」。`}</p></div></div><small>下次複習：{formatRelativeReview(result.review.nextReviewAt)}</small><details><summary>查看含答案的完整語境</summary><p>{fact.context}</p></details></div>}
  </div>
}

function ReadingPanel({ article, fontScale, onIncrease, onDecrease }: { article: LawArticle; fontScale: number; onIncrease: () => void; onDecrease: () => void }): JSX.Element {
  return <div className="reading-panel"><div className="reading-controls"><span>閱讀字級</span><Button variant="ghost" onClick={onDecrease}>A−</Button><strong>{Math.round(fontScale * 100)}%</strong><Button variant="ghost" onClick={onIncrease}>A＋</Button></div><p className="article-original large" style={{ fontSize: `${fontScale}rem` }}>{article.text}</p><Notice tone="info">先看完全文，再按下方按鈕進入構成要件、法律效果與刑罰選擇題。</Notice></div>
}

function OrderingPanel({ items, onMove }: { items: string[]; onMove: (from: number, to: number) => void }): JSX.Element {
  return <div className="ordering-panel"><Notice tone="info">請用每段右側的箭頭調整順序；手機上以按鈕操作較穩定，也支援觸控裝置。</Notice><div className="ordering-list">{items.map((item, index) => <div className="ordering-item" draggable onDragStart={(event) => event.dataTransfer.setData('text/plain', String(index))} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { const from = Number(event.dataTransfer.getData('text/plain')); if (Number.isInteger(from)) onMove(from, index) }} key={`${item}-${index}`}><span className="drag-handle">⠿</span><span className="order-number">{index + 1}</span><p>{item}</p><div className="order-buttons"><button disabled={index === 0} onClick={() => onMove(index, index - 1)} aria-label="上移">↑</button><button disabled={index === items.length - 1} onClick={() => onMove(index, index + 1)} aria-label="下移">↓</button></div></div>)}</div></div>
}

function ResultPanel({ result }: { result: SubmissionResult }): JSX.Element {
  const comparison = result.answer.comparison
  return <div className="result-panel"><div className="result-hero"><div><span className="eyebrow">RESULT / 作答結果</span><h3>{result.answer.score >= 95 ? '精準命中' : result.answer.score >= 80 ? '持續修正' : '需要重新學習'}</h3></div><div className={`result-score grade-${comparison.grade}`}><strong>{Math.round(result.answer.score)}</strong><span>{comparison.grade} 級</span></div></div><div className="result-metrics"><div><span>逐字正確率</span><strong>{Math.round(comparison.accuracy)}%</strong></div><div><span>關鍵字正確率</span><strong>{Math.round(comparison.keywordAccuracy)}%</strong></div><div><span>結構正確率</span><strong>{Math.round(comparison.structureAccuracy)}%</strong></div><div><span>下次複習</span><strong>{formatRelativeReview(result.review.nextReviewAt)}</strong></div></div><ComparisonView comparison={comparison} />{comparison.errors.length ? <div className="error-list"><h4>需要修正的地方 <span>{comparison.errors.length}</span></h4>{comparison.errors.slice(0, 12).map((error, index) => <div className={`error-item ${error.isHighWeight ? 'high-weight' : ''}`} key={`${error.kind}-${index}`}><span>{error.isHighWeight ? '高權重' : error.kind === 'missing' ? '漏字' : error.kind === 'extra' ? '多字' : error.kind === 'structure' ? '結構' : '錯字'}</span><p>{error.message}</p></div>)}</div> : <Notice tone="success">沒有偵測到錯字、漏字、多字或結構錯誤。</Notice>}</div>
}

function ComparisonView({ comparison }: { comparison: ComparisonResult }): JSX.Element {
  return <div className="comparison-view"><div className="comparison-legend"><span className="legend-equal">正確</span><span className="legend-missing">漏字</span><span className="legend-extra">多字</span><span className="legend-replace">錯字</span></div><div className="comparison-line"><span className="comparison-label">你的答案</span><p>{comparison.parts.map((part, index) => part.type === 'equal' ? <span key={index} className="diff-equal">{part.actual}</span> : part.type === 'extra' ? <span key={index} className="diff-extra">{part.actual}</span> : part.type === 'replacement' ? <span key={index} className="diff-replace">{part.actual}<small>應為 {part.expected}</small></span> : <span key={index} className="diff-missing">{part.expected}<small>漏寫</small></span>)}</p></div><details><summary>查看原文</summary><p className="comparison-original">{comparison.expected}</p></details></div>
}

function modeCaption(mode: TrainingMode): string {
  if (mode === 'comprehension') return '先懂再背'
  if (mode === 'reading') return '建立記憶'
  if (mode === 'numbers') return '高頻陷阱'
  if (mode === 'keywords') return '法定用語'
  if (mode === 'ordering') return '語意順序'
  return '訓練流程'
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
