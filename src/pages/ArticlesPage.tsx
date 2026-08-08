import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ExamPresetImporter } from '../components/ExamPresetImporter'
import { OfficialLawImporter } from '../components/OfficialLawImporter'
import { LawStructureMap } from '../components/LawStructureMap'
import { Button, EmptyState, Modal, Notice, PageHeader, ProgressBar, StatusBadge } from '../components/ui'
import { useAppData } from '../context/AppContext'
import type { ArticleHighlight, ExamSubject, ImportArticleDraft, LawArticle, LawType } from '../types'
import type { OfficialLawDataSource, OfficialLawSummary } from '../lib/officialLaws'
import { POLICE_SERGEANT_EXAM_PRESET, type ExamPresetBundle, type ExamPresetImportResult } from '../lib/examPreset'
import { parseJsonImport, splitLawText } from '../lib/importer'
import { splitArticleTextBlocks } from '../lib/articleStructure'
import { CRIMINAL_PROCEDURE_FREQUENCY_TOPICS, compareExamFrequency, examFrequencyTier, isCriminalProcedureLaw } from '../lib/criminalProcedureFrequency'
import { EXAM_SUBJECTS, EXAM_SUBJECT_LABELS, LAW_TYPE_LABELS, classifyExamSubject, classifyLawType } from '../lib/examSubjects'
import { buildLawSystemMap, compareArticleNumbers, flattenSystemNodes } from '../lib/lawSystem'

type ImportKind = 'official' | 'text' | 'json' | 'external'
type ExternalFormat = 'text' | 'json'
type ArticleSortMode = 'frequency' | 'number'

export function ArticlesPage(): JSX.Element {
  const data = useAppData()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeLaws = data.laws.filter((law) => !law.deletedAt)
  const [selectedLawId, setSelectedLawId] = useState(searchParams.get('law') ?? '')
  const [selectedSubject, setSelectedSubject] = useState<ExamSubject | undefined>(asExamSubject(searchParams.get('subject')))
  const [input, setInput] = useState('')
  const [importKind, setImportKind] = useState<ImportKind>('official')
  const [externalFormat, setExternalFormat] = useState<ExternalFormat>('text')
  const [externalName, setExternalName] = useState('')
  const [externalShortName, setExternalShortName] = useState('')
  const [externalSourceUrl, setExternalSourceUrl] = useState('')
  const [externalSubject, setExternalSubject] = useState<Exclude<ExamSubject, 'unclassified'>>('police-law')
  const [externalLawType, setExternalLawType] = useState<LawType>('order')
  const [importOpen, setImportOpen] = useState(false)
  const [preview, setPreview] = useState<ImportArticleDraft[]>([])
  const [search, setSearch] = useState('')
  const [librarySearch, setLibrarySearch] = useState('')
  const [sortMode, setSortMode] = useState<ArticleSortMode>('frequency')
  const [visibleCount, setVisibleCount] = useState(40)
  const [collapsedChapters, setCollapsedChapters] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<LawArticle | null>(null)
  const [studyEditing, setStudyEditing] = useState<LawArticle | null>(null)
  const [activeNodeId, setActiveNodeId] = useState<string>()
  const fileInput = useRef<HTMLInputElement>(null)
  const selectedLaw = activeLaws.find((law) => law.id === selectedLawId)
  const selectedSubjectLaws = selectedSubject ? activeLaws.filter((law) => (law.examSubject ?? classifyExamSubject(law)) === selectedSubject) : []
  const isCriminalProcedure = isCriminalProcedureLaw(selectedLaw)
  const presetLawNames = useMemo(() => new Set(POLICE_SERGEANT_EXAM_PRESET.laws.map((law) => normalizeName(law.name))), [])
  const presetLaws = activeLaws.filter((law) => presetLawNames.has(normalizeName(law.name)))
  const presetLawIds = new Set(presetLaws.map((law) => law.id))
  const presetArticleCount = data.articles.filter((article) => !article.deletedAt && presetLawIds.has(article.lawId)).length
  const lawArticles = useMemo(() => data.articles.filter((article) => article.lawId === selectedLawId && !article.deletedAt).sort(compareArticleNumbers), [data.articles, selectedLawId])
  const systemMap = useMemo(() => buildLawSystemMap(lawArticles), [lawArticles])
  const nodeByAnchor = useMemo(() => new Map(flattenSystemNodes(systemMap.roots).map((node) => [node.anchorArticleId, node.id])), [systemMap])
  const subjectStats = useMemo(() => new Map(EXAM_SUBJECTS.map((subject) => {
    const laws = activeLaws.filter((law) => (law.examSubject ?? classifyExamSubject(law)) === subject.id)
    const articles = data.articles.filter((article) => !article.deletedAt && laws.some((law) => law.id === article.lawId))
    const scores = articles.map((article) => data.mastery.find((item) => item.articleId === article.id)?.score ?? 0)
    const masteryMap = new Map(data.mastery.map((item) => [item.articleId, item]))
    const dueIds = new Set(data.reviews.filter((review) => new Date(review.nextReviewAt).getTime() <= Date.now()).map((review) => review.articleId))
    return [subject.id, { laws, articles, average: scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0, learned: scores.filter((score) => score > 0).length, mastered: scores.filter((score) => score >= 90).length, due: articles.filter((article) => dueIds.has(article.id)).length, highRisk: articles.filter((article) => ['高風險', '需要重新學習'].includes(masteryMap.get(article.id)?.status ?? '')).length }] as const
  })), [activeLaws, data.articles, data.mastery, data.reviews])
  const globalResults = useMemo(() => {
    const query = librarySearch.trim().toLocaleLowerCase('zh-Hant')
    if (!query) return []
    return data.articles.filter((article) => {
      const law = activeLaws.find((item) => item.id === article.lawId)
      return !article.deletedAt && law && `${law.name} ${law.shortName} ${article.articleNumber} ${article.title} ${article.text}`.toLocaleLowerCase('zh-Hant').includes(query)
    }).slice(0, 12)
  }, [activeLaws, data.articles, librarySearch])
  const articles = useMemo(() => data.articles.filter((article) => article.lawId === selectedLawId
    && !article.deletedAt
    && (article.articleNumber.includes(search) || article.text.includes(search) || article.title.includes(search)))
    .sort(sortMode === 'frequency' && isCriminalProcedure
      ? (left, right) => compareExamFrequency(left, right) || compareArticleNumbers(left, right)
      : compareArticleNumbers), [data.articles, isCriminalProcedure, search, selectedLawId, sortMode])
  const visibleArticles = articles.slice(0, visibleCount)
  const articleChapterGroups = useMemo(() => {
    const chapterNodes = flattenSystemNodes(systemMap.roots).filter((node) => node.level === '章')
    const groups = new Map<string, { id: string; label: string; articles: LawArticle[] }>()
    for (const article of visibleArticles) {
      const chapter = chapterNodes.find((node) => node.articleIds.includes(article.id))
      const id = chapter?.id ?? 'article-guide'
      const label = chapter?.label ?? '條號導覽（官方未提供章節）'
      const group = groups.get(id) ?? { id, label, articles: [] }
      group.articles.push(article)
      groups.set(id, group)
    }
    return [...groups.values()]
  }, [systemMap.roots, visibleArticles])
  const importPlaceholder = importKind === 'text' || importKind === 'external'
    ? '例如：\n第1條\n法條內容……\n\n第 2 條\n下一條內容……'
    : '{"articles":[{"articleNumber":"1","text":"法條內容"}]}'
  const officialPreview = preview.some((draft) => draft.source?.type === 'moj-law')

  useEffect(() => {
    if (!selectedLawId || !lawArticles.length) return
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0]
      const articleId = visible?.target.getAttribute('data-law-article-id')
      if (articleId) setActiveNodeId(nodeByAnchor.get(articleId))
    }, { rootMargin: '-92px 0px -55% 0px', threshold: [0, .25, .75, 1] })
    document.querySelectorAll<HTMLElement>('[data-law-article-id]').forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [lawArticles.length, nodeByAnchor, selectedLawId, visibleCount, search])

  function changeLaw(id: string): void {
    setSelectedLawId(id)
    setSearch('')
    setVisibleCount(40)
    const nextLaw = activeLaws.find((law) => law.id === id)
    setSortMode(isCriminalProcedureLaw(nextLaw) ? 'frequency' : 'number')
    const nextSubject = activeLaws.find((law) => law.id === id)?.examSubject ?? (activeLaws.find((law) => law.id === id) ? classifyExamSubject(activeLaws.find((law) => law.id === id)!) : undefined)
    setSelectedSubject(nextSubject)
    setSearchParams(id ? { law: id, ...(nextSubject ? { subject: nextSubject } : {}) } : {})
  }

  function chooseSubject(subject: Exclude<ExamSubject, 'unclassified'>): void {
    const laws = activeLaws.filter((law) => (law.examSubject ?? classifyExamSubject(law)) === subject)
    setSelectedSubject(subject)
    setSearch('')
    if (laws.length === 1) {
      changeLaw(laws[0].id)
      return
    }
    setSelectedLawId('')
    setSearchParams({ subject })
  }

  function scrollToArticle(articleId: string): void {
    const index = articles.findIndex((article) => article.id === articleId)
    if (index < 0) {
      setSearch('')
      setSortMode('number')
      const sortedIndex = lawArticles.findIndex((article) => article.id === articleId)
      setVisibleCount(Math.max(40, sortedIndex + 1))
    } else {
      setVisibleCount(Math.max(visibleCount, index + 1))
    }
    window.setTimeout(() => document.querySelector(`[data-law-article-id="${articleId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  function generatePreview(): void {
    setError('')
    setMessage('')
    if (!selectedLawId) { setError('請先建立並選擇一部法規。'); return }
    if (!input.trim()) { setError('請貼上法條文字或選擇匯入檔案。'); return }
    try {
      const drafts = importKind === 'json' ? parseJsonImport(input) : splitLawText(input)
      if (!drafts.length) throw new Error('沒有拆出任何法條，請確認內容包含「第○條」格式。')
      setImportOpen(true)
      setPreview(drafts)
      setMessage(`已拆分 ${drafts.length} 條，請在下方預覽確認後儲存。`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '法條拆分失敗。')
    }
  }

  async function readFile(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      setInput(text)
      if (importKind === 'external') setExternalFormat(file.name.toLowerCase().endsWith('.json') ? 'json' : 'text')
      else setImportKind(file.name.toLowerCase().endsWith('.json') ? 'json' : 'text')
      setMessage(`已讀取 ${file.name}，按「產生預覽」檢查拆分結果。`)
    } catch {
      setError('檔案讀取失敗，請確認檔案仍可存取。')
    }
    event.target.value = ''
  }

  async function generateExternalPreview(): Promise<void> {
    setError('')
    setMessage('')
    if (!externalName.trim()) { setError('請先填寫外部警察法規命令名稱。'); return }
    if (!input.trim()) { setError('請貼上法條文字或選擇 TXT／JSON 檔案。'); return }
    try {
      const drafts = externalFormat === 'json' ? parseJsonImport(input) : splitLawText(input)
      if (!drafts.length) throw new Error('沒有拆出任何法條，請確認內容包含「第○條」格式。')
      let target = activeLaws.find((law) => normalizeName(law.name) === normalizeName(externalName))
      if (!target) {
        target = await data.createLaw({
          name: externalName.trim(),
          shortName: externalShortName.trim() || externalName.trim(),
          category: '警察法規',
          examSubject: externalSubject,
          lawType: externalLawType,
          importance: 3,
          examScope: true,
          notes: `外部警察法規命令匯入${externalSourceUrl.trim() ? `；來源：${externalSourceUrl.trim()}` : ''}。內容由使用者提供，請自行核對現行版本。`,
        })
      }
      changeLaw(target.id)
      setImportOpen(true)
      setPreview(drafts)
      setMessage(`已建立「${target.name}」並放入 ${drafts.length} 條外部法規預覽；確認後才會寫入本機。`)
      window.setTimeout(() => document.getElementById('import-preview')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '外部警察法規命令解析失敗。')
    }
  }

  async function prepareOfficialImport(law: OfficialLawSummary, source: OfficialLawDataSource, drafts: ImportArticleDraft[]): Promise<void> {
    setError('')
    setMessage('')
    let target = activeLaws.find((item) => item.source?.lawCode === law.code || normalizeName(item.name) === normalizeName(law.name))
    if (!target) {
      target = await data.createLaw({
        name: law.name,
        shortName: law.name.replace(/^中華民國/, '') || law.name,
        category: law.category || law.level || '官方法規',
        examSubject: classifyExamSubject({ name: law.name, shortName: law.name, category: law.category || law.level || '官方法規', source: drafts[0]?.source }),
        lawType: classifyLawType({ name: law.name, source: drafts[0]?.source }),
        importance: 3,
        examScope: true,
        notes: `由法務部全國法規資料庫建立；官方資料更新日期：${source.dataUpdatedAt}。`,
        source: drafts[0]?.source,
      })
    }
    changeLaw(target.id)
    setImportOpen(true)
    setPreview(drafts)
    setMessage(`已將「${law.name}」的 ${drafts.length} 條官方條文放入預覽，確認原文後再儲存。`)
    window.setTimeout(() => document.getElementById('import-preview')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }

  async function importExamPreset(bundle: ExamPresetBundle): Promise<ExamPresetImportResult> {
    setImportOpen(true)
    const result = await data.importExamPreset(bundle)
    if (result.lawIds[0]) changeLaw(result.lawIds[0])
    return result
  }

  function updateDraft(index: number, patch: Partial<ImportArticleDraft>): void {
    setPreview((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item))
  }

  async function savePreview(): Promise<void> {
    setError('')
    try {
      await data.saveImportedArticles(selectedLawId, preview)
      const savedCount = preview.length
      setPreview([])
      setInput('')
      setMessage(`已儲存 ${savedCount} 條法條。`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '法條儲存失敗。')
    }
  }

  async function saveArticle(article: LawArticle): Promise<void> {
    try {
      await data.updateArticle(article)
      setEditing(null)
      setMessage(`第 ${article.articleNumber} 條已更新。`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '法條更新失敗。')
    }
  }

  async function saveStudyArticle(article: LawArticle): Promise<void> {
    try {
      await data.updateArticle(article)
      setStudyEditing(null)
      setMessage(`第 ${article.articleNumber} 條的筆記與考題已儲存。`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '筆記與考題儲存失敗。')
    }
  }

  async function removeArticle(article: LawArticle): Promise<void> {
    if (!window.confirm(`確定要刪除第 ${article.articleNumber} 條嗎？作答紀錄會保留。`)) return
    try {
      await data.deleteArticle(article.id)
      setMessage(`第 ${article.articleNumber} 條已封存。`)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '法條刪除失敗。')
    }
  }

  return <div className="page-stack">
    <PageHeader
      eyebrow="LIBRARY / LAW ARTICLES"
      title="法條瀏覽"
      description="先從五大考科進入法規，再以體系圖建立架構，最後閱讀全文、複習考頻與整理筆記。"
      actions={selectedLawId && <Button variant="secondary" onClick={() => { setImportOpen(true); setPreview((items) => [...items, emptyDraft()]) }}>＋ 手動新增</Button>}
    />
    {error && <Notice tone="warning">{error}</Notice>}
    {message && <Notice tone="success">{message}</Notice>}

    {!selectedLaw && <>
      <section className="article-library-search card">
        <div><p className="eyebrow">LIBRARY SEARCH / 全域搜尋</p><h2>搜尋法規、條號或全文</h2><p className="muted-text">從考科首頁直接找法規、條號、標題與關鍵字。</p></div>
        <label className="search-box"><span>⌕</span><input value={librarySearch} onChange={(event) => setLibrarySearch(event.target.value)} placeholder="例如：刑法 271、羈押、警察職權" /></label>
        {globalResults.length > 0 && <div className="library-search-results">{globalResults.map((article) => { const law = activeLaws.find((item) => item.id === article.lawId); return <button type="button" key={article.id} onClick={() => { if (law) { setSelectedSubject(law.examSubject ?? classifyExamSubject(law)); changeLaw(law.id) } }}><strong>{law?.shortName ?? law?.name} · 第 {article.articleNumber} 條</strong><span>{article.title || article.text.slice(0, 92)}</span></button> })}</div>}
      </section>
      <section className="exam-subject-grid" aria-label="五大考科">
        {EXAM_SUBJECTS.map((subject) => { const stats = subjectStats.get(subject.id)!; return <button type="button" className={`exam-subject-card card ${selectedSubject === subject.id ? 'is-selected' : ''}`} key={subject.id} onClick={() => chooseSubject(subject.id)}><span className="exam-subject-symbol">{subject.shortLabel.slice(0, 1)}</span><span className="exam-subject-copy"><small>EXAM SUBJECT</small><strong>{subject.label}</strong><em>{subject.description}</em></span><span className="exam-subject-stats"><b>{stats.laws.length} 部法規</b><span>{stats.articles.length} 條 · 已學 {stats.learned} · 已精通 {stats.mastered}</span><span>待複習 {stats.due} · 高風險 {stats.highRisk}</span><ProgressBar value={stats.average} showValue={false} tone={stats.average >= 90 ? 'green' : stats.average >= 70 ? 'gold' : 'blue'} /><small>整體熟練度 {Math.round(stats.average)}% · {stats.articles.length ? Math.round((stats.learned / stats.articles.length) * 100) : 0}% 已開始</small></span></button> })}
      </section>
      {selectedSubject && <section className="law-chooser card"><div className="card-heading"><div><p className="eyebrow">{EXAM_SUBJECT_LABELS[selectedSubject]} / LAW COLLECTION</p><h2>選擇要閱讀的法規</h2><p className="muted-text">核心法規、子法與施行規則分開呈現；選取後會直接進入全文與體系圖。</p></div><Button variant="ghost" onClick={() => { setSelectedSubject(undefined); setSearchParams({}) }}>返回五大考科</Button></div>{selectedSubjectLaws.length ? <div className="law-chooser-grid">{selectedSubjectLaws.map((law) => { const lawArticleCount = data.articles.filter((article) => article.lawId === law.id && !article.deletedAt).length; const average = lawArticleCount ? data.articles.filter((article) => article.lawId === law.id && !article.deletedAt).reduce((sum, article) => sum + (data.mastery.find((item) => item.articleId === article.id)?.score ?? 0), 0) / lawArticleCount : 0; return <button type="button" className="law-chooser-card" key={law.id} onClick={() => changeLaw(law.id)}><span><strong>{law.name}</strong><small>{LAW_TYPE_LABELS[law.lawType ?? classifyLawType(law)]} · {lawArticleCount} 條法條</small></span><span><b>{Math.round(average)}%</b><em>熟練度</em></span></button> })}</div> : <EmptyState icon="⌘" title="這個考科尚未有法規" description="可在下方匯入工具從全國法規資料庫挑選，或匯入外部法規。" />}</section>}
    </>}

    {selectedLaw && <div className="law-breadcrumb"><button type="button" onClick={() => { setSelectedLawId(''); setSearchParams(selectedSubject ? { subject: selectedSubject } : {}) }}>法條瀏覽</button><span>›</span><button type="button" onClick={() => { setSelectedLawId(''); setSearchParams(selectedSubject ? { subject: selectedSubject } : {}) }}>{EXAM_SUBJECT_LABELS[selectedLaw.examSubject ?? classifyExamSubject(selectedLaw)]}</button><span>›</span><strong>{selectedLaw.name}</strong></div>}

    <section className={`import-workbench card ${importOpen ? 'is-open' : 'is-collapsed'}`}>
      <div className="workbench-head">
        <div><p className="eyebrow">IMPORT / 法條匯入</p><h2>匯入工具 <span className="muted">· {importKind === 'official' ? '全國法規資料庫' : importKind === 'external' ? '外部警察法規命令' : importKind.toUpperCase()}</span></h2><p className="muted-text">需要新增或更新法條時再展開；平常閱讀不佔用畫面。</p></div>
        <div className="workbench-head-actions">{importKind !== 'official' && activeLaws.length > 0 && <div className="law-select-wrap"><label>匯入至<select value={selectedLawId} onChange={(event) => changeLaw(event.target.value)}>{activeLaws.map((law) => <option value={law.id} key={law.id}>{law.name}</option>)}</select></label></div>}<Button variant="secondary" onClick={() => setImportOpen((open) => !open)}>{importOpen ? '收起匯入工具' : '展開匯入工具'}</Button></div>
      </div>
      {importOpen && (<div className="workbench-body"><div className="import-tabs" role="tablist" aria-label="匯入方式">
        <button type="button" role="tab" aria-selected={importKind === 'official'} className={importKind === 'official' ? 'selected' : ''} onClick={() => setImportKind('official')}>全國法規資料庫</button>
        <button type="button" role="tab" aria-selected={importKind === 'text'} className={importKind === 'text' ? 'selected' : ''} onClick={() => setImportKind('text')}>貼上純文字 / TXT</button>
        <button type="button" role="tab" aria-selected={importKind === 'json'} className={importKind === 'json' ? 'selected' : ''} onClick={() => setImportKind('json')}>JSON</button>
        <button type="button" role="tab" aria-selected={importKind === 'external'} className={importKind === 'external' ? 'selected' : ''} onClick={() => setImportKind('external')}>外部警察法規命令</button>
      </div>
      {importKind === 'official'
        ? <div className="official-import-stack"><ExamPresetImporter existingLawCount={presetLaws.length} existingArticleCount={presetArticleCount} onImport={importExamPreset} /><OfficialLawImporter localLaws={activeLaws} localArticles={data.articles} onPrepare={prepareOfficialImport} /></div>
        : importKind === 'external'
          ? <div className="manual-import-panel external-command-panel">
            <div className="form-grid">
              <label>法規命令名稱<input value={externalName} onChange={(event) => setExternalName(event.target.value)} placeholder="例如：警察機關處理○○案件作業規定" /></label>
              <label>簡稱（可留白）<input value={externalShortName} onChange={(event) => setExternalShortName(event.target.value)} placeholder="例如：○○作業規定" /></label>
              <label>來源網址（可留白）<input value={externalSourceUrl} onChange={(event) => setExternalSourceUrl(event.target.value)} placeholder="https://…" /></label>
              <label>資料格式<select value={externalFormat} onChange={(event) => setExternalFormat(event.target.value as ExternalFormat)}><option value="text">純文字 / TXT</option><option value="json">JSON</option></select></label>
              <label>所屬考科<select value={externalSubject} onChange={(event) => setExternalSubject(event.target.value as Exclude<ExamSubject, 'unclassified'>)}>{EXAM_SUBJECTS.map((subject) => <option value={subject.id} key={subject.id}>{subject.label}</option>)}</select></label>
              <label>法規類型<select value={externalLawType} onChange={(event) => setExternalLawType(event.target.value as LawType)}>{Object.entries(LAW_TYPE_LABELS).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
            </div>
            <textarea className="import-textarea" value={input} onChange={(event) => setInput(event.target.value)} placeholder={externalFormat === 'text' ? '例如：\n第1條\n法規命令內容……\n\n第2條\n下一條內容……' : '{"articles":[{"articleNumber":"1","text":"法規命令內容"}]}' } />
            <div className="import-actions"><input ref={fileInput} type="file" accept=".txt,.json,text/plain,application/json" hidden onChange={(event) => void readFile(event)} /><Button variant="secondary" onClick={() => fileInput.current?.click()}>選擇 TXT／JSON</Button><Button onClick={() => void generateExternalPreview()}>建立外部法規預覽</Button></div>
            <Notice tone="info">適合匯入警察機關自訂作業規定、函釋整理或其他未收錄於法務部資料集的法規命令；確認預覽後才會寫入本機 IndexedDB。</Notice>
          </div>
        : activeLaws.length
          ? <div className="manual-import-panel"><textarea className="import-textarea" value={input} onChange={(event) => setInput(event.target.value)} placeholder={importPlaceholder} /><div className="import-actions"><input ref={fileInput} type="file" accept=".txt,.json,text/plain,application/json" hidden onChange={(event) => void readFile(event)} /><Button variant="secondary" onClick={() => fileInput.current?.click()}>選擇檔案</Button><Button onClick={generatePreview}>產生拆分預覽</Button></div></div>
          : <Notice tone="warning"><div>TXT 與 JSON 必須先指定本機法規；請先從上方五大考科選擇法規，或切回「全國法規資料庫」建立法規。</div><Button variant="ghost" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>回到考科選擇</Button></Notice>}</div>)}
    </section>

    {preview.length > 0 && <section className="preview-section card" id="import-preview">
      <div className="card-heading"><div><p className="eyebrow">PREVIEW / 待確認</p><h2>匯入預覽 <span className="count-chip">{preview.length}</span></h2></div><div className="card-actions"><Button variant="ghost" onClick={() => setPreview([])}>清除預覽</Button><Button onClick={() => void savePreview()}>確認並儲存</Button></div></div>
      <Notice tone="warning">{officialPreview ? '這批資料來自法務部官方資料集，但仍請核對條號與原文；如與主管機關公布內容不同，以主管機關公布內容為準。' : '這是儲存前預覽。請確認條號與原文，系統不會自行補正正式法規內容。'}</Notice>
      <div className="preview-list">{preview.map((draft, index) => <div className="preview-row" key={`${index}-${draft.articleNumber}`}>
        <div className="preview-index">{String(index + 1).padStart(2, '0')}</div>
        <div className="preview-fields">
          <div className="preview-inline"><label>條號<input value={draft.articleNumber} onChange={(event) => updateDraft(index, { articleNumber: event.target.value })} /></label><label>標題<input value={draft.title} onChange={(event) => updateDraft(index, { title: event.target.value })} placeholder="可留白" /></label><label>重要程度<select value={draft.importance} onChange={(event) => updateDraft(index, { importance: Number(event.target.value) as 1 | 2 | 3 | 4 | 5 })}>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}</select></label></div>
          <textarea value={draft.text} onChange={(event) => updateDraft(index, { text: event.target.value })} rows={4} />
          <div className="preview-checks"><label className="checkbox-row"><input type="checkbox" checked={draft.mustMemorize} onChange={(event) => updateDraft(index, { mustMemorize: event.target.checked })} /> 必背</label><label className="checkbox-row"><input type="checkbox" checked={draft.includeDaily} onChange={(event) => updateDraft(index, { includeDaily: event.target.checked })} /> 加入每日任務</label>{draft.source && <span className="official-source-badge">官方資料 · {draft.source.dataUpdatedAt}</span>}</div>
        </div>
        <button className="icon-button danger-icon" onClick={() => setPreview((items) => items.filter((_, itemIndex) => itemIndex !== index))} aria-label="移除預覽項目">×</button>
      </div>)}</div>
    </section>}

    {selectedLaw && <LawStructureMap lawName={selectedLaw.name} map={systemMap} mastery={data.mastery} activeNodeId={activeNodeId} onSelectArticle={scrollToArticle} />}

    {selectedLaw && isCriminalProcedure && <section className="frequency-overview card">
      <div className="frequency-overview-head">
        <div><p className="eyebrow">EXAM FREQUENCY / 刑訴考頻</p><h2>120 個爭點，先把高頻區背熟</h2><p className="muted-text">依你提供的統計匯入。S 級為前 15 名、A 級為第 16–40 名；可明確對應的刑訴條文已自動提高每日任務與訓練順位。</p></div>
        <div className="frequency-tier-summary"><span className="tier-s"><strong>15</strong>S 級</span><span className="tier-a"><strong>25</strong>A 級</span><span className="tier-b"><strong>35</strong>B 級</span><span className="tier-c"><strong>45</strong>C 級</span></div>
      </div>
      <details className="frequency-topic-details">
        <summary>查看完整 120 個爭點排行</summary>
        <div className="frequency-topic-list">{CRIMINAL_PROCEDURE_FREQUENCY_TOPICS.map((topic) => <div className="frequency-topic-row" key={topic.rank}>
          <span className={`frequency-rank tier-${examFrequencyTier(topic.rank).toLowerCase()}`}>#{topic.rank}</span>
          <span className="frequency-category">{topic.category}</span>
          <strong>{topic.title}</strong>
          <span className="frequency-count">{topic.count} 次</span>
          <small>{topic.articleNumbers.length ? `刑訴法：${topic.articleNumbers.map((number) => `§${number}`).join('、')}` : '跨法規／實務爭點'}</small>
        </div>)}</div>
      </details>
      <p className="frequency-source-note">考頻來源：使用者提供的 120 爭點圖片，並非官方統計；條文內容仍以系統內法務部官方資料為準。</p>
    </section>}

    {selectedLaw ? <section className="article-browser">
      <div className="section-toolbar"><div><p className="eyebrow">BROWSER / {selectedLaw.shortName}</p><h2>已儲存法條 <span className="count-chip">{articles.length}</span></h2></div><div className="article-toolbar-actions">{isCriminalProcedure && <div className="sort-segment" aria-label="法條排序方式"><button type="button" className={sortMode === 'frequency' ? 'active' : ''} onClick={() => { setSortMode('frequency'); setVisibleCount(40) }}>考頻優先</button><button type="button" className={sortMode === 'number' ? 'active' : ''} onClick={() => { setSortMode('number'); setVisibleCount(40) }}>條號順序</button></div>}<label className="search-box"><span>⌕</span><input value={search} onChange={(event) => { setSearch(event.target.value); setVisibleCount(40) }} placeholder="搜尋條號、標題或文字" /></label></div></div>
      {articles.length ? <><div className="article-list article-chapter-list">{articleChapterGroups.map((group) => { const open = !collapsedChapters.has(group.id); return <section className={`article-chapter-group ${open ? 'is-open' : 'is-collapsed'}`} key={group.id}><button type="button" className="article-chapter-toggle" aria-expanded={open} onClick={() => setCollapsedChapters((current) => { const next = new Set(current); if (open) next.add(group.id); else next.delete(group.id); return next })}><span>{open ? '▼' : '▶'}</span><strong>{group.label}</strong><small>{group.articles.length} 條顯示中</small></button>{open && group.articles.map((article) => <ArticleRow key={article.id} article={article} chapterLabel={group.label} onStudy={() => setStudyEditing(article)} onEdit={() => setEditing(article)} onTrain={() => navigate(`/training/${article.id}`)} onDelete={() => void removeArticle(article)} />)}</section> })}</div>{visibleCount < articles.length && <div className="article-load-more"><span>目前顯示 {visibleArticles.length}／{articles.length} 條</span><Button variant="secondary" onClick={() => setVisibleCount((count) => count + 40)}>再顯示 40 條</Button></div>}</> : <EmptyState icon="≡" title="這部法規還沒有法條" description="從官方資料庫勾選條文，或貼上文字並產生預覽。" />}
    </section> : <EmptyState icon="⌕" title="先搜尋並選擇法條" description="上方可直接搜尋全國法規資料庫；選好條文後，系統會自動建立對應的本機法規。" />}

    {editing && <Modal title={`編輯第 ${editing.articleNumber} 條`} onClose={() => setEditing(null)}><ArticleEditForm article={editing} onCancel={() => setEditing(null)} onSave={(article) => void saveArticle(article)} /></Modal>}
    {studyEditing && <Modal title={`整理第 ${studyEditing.articleNumber} 條`} onClose={() => setStudyEditing(null)}><ArticleStudyForm article={studyEditing} onCancel={() => setStudyEditing(null)} onSave={(article) => void saveStudyArticle(article)} /></Modal>}
  </div>
}

function ArticleRow({ article, chapterLabel, onStudy, onEdit, onTrain, onDelete }: { article: LawArticle; chapterLabel?: string; onStudy: () => void; onEdit: () => void; onTrain: () => void; onDelete: () => void }): JSX.Element {
  return <LegacyArticleRow article={article} chapterLabel={chapterLabel} onStudy={onStudy} onEdit={onEdit} onTrain={onTrain} onDelete={onDelete} />
}

function LegacyArticleRow({ article, chapterLabel, onStudy, onEdit, onTrain, onDelete }: { article: LawArticle; chapterLabel?: string; onStudy: () => void; onEdit: () => void; onTrain: () => void; onDelete: () => void }): JSX.Element {
  const data = useAppData()
  const mastery = data.mastery.find((item) => item.articleId === article.id)
  const questionCount = article.questions?.filter(Boolean).length ?? 0
  return <article className="article-row card" id={`law-article-${article.id}`} data-law-article-id={article.id}>
    <div className="article-row-head">
      <div className="article-number">第<strong>{article.articleNumber}</strong>條</div>
      <div className="article-row-tags">
        {article.examFrequency && <span className={`frequency-chip tier-${article.examFrequency.tier.toLowerCase()}`}>#{article.examFrequency.bestRank} · {article.examFrequency.tier}級 · {article.examFrequency.totalCount}次</span>}
        {article.mustMemorize && <span className="must-tag">必背</span>}
        {article.isBoss && <span className="boss-tag">魔王</span>}
        {article.source && <span className="official-source-badge">官方匯入</span>}
        {article.notes.trim() && <span className="study-tag">有筆記</span>}
        {questionCount > 0 && <span className="study-tag">考題 {questionCount}</span>}
        <StatusBadge status={mastery?.status ?? '未開始'} />
      </div>
    </div>
    <div className="article-row-content">
      <div className="article-row-title">
        {article.title && article.title !== chapterLabel && <h3>{article.title}</h3>}
        {article.examFrequency && <p className="article-frequency-topics">{article.examFrequency.topics.slice(0, 3).map((topic) => `#${topic.rank} ${topic.title}`).join(' · ')}</p>}
        <ArticleTextBlocks text={article.text} highlights={article.highlights ?? []} />
      </div>
    </div>
    <div className="article-row-footer">
      <div className="article-row-progress"><strong>{Math.round(mastery?.score ?? 0)}%</strong><ProgressBar value={mastery?.score ?? 0} showValue={false} tone={(mastery?.score ?? 0) >= 80 ? 'green' : 'blue'} /></div>
      <div className="row-actions"><Button variant="secondary" onClick={onTrain}>訓練</Button><Button variant="ghost" onClick={onStudy}>筆記／考題</Button><Button variant="ghost" onClick={onEdit}>編輯</Button><button className="icon-button danger-icon" onClick={onDelete} aria-label="封存法條">×</button></div>
    </div>
    <ArticleHighlightTools article={article} />
  </article>
}

function ArticleTextBlocks({ text, highlights }: { text: string; highlights: ArticleHighlight[] }): JSX.Element {
  const blocks = splitArticleTextBlocks(text)
  return <div className="article-structured-text" aria-label="法條項次內容">{blocks.map((block, index) => <div className={`article-text-block article-text-${block.kind}`} key={`${block.paragraphNumber}-${index}-${block.text}`}>{block.kind === 'paragraph' && <span className="article-text-label">第 {block.paragraphNumber} 項</span>}<p>{renderHighlightedText(block.text, highlights, `${block.paragraphNumber}-${index}`)}</p></div>)}</div>
}

function renderHighlightedText(text: string, highlights: ArticleHighlight[], keyPrefix: string): JSX.Element[] {
  const ordered = highlights
    .filter((highlight) => text.includes(highlight.text))
    .sort((left, right) => text.indexOf(left.text) - text.indexOf(right.text))
  const parts: JSX.Element[] = []
  let cursor = 0
  for (const highlight of ordered) {
    const start = text.indexOf(highlight.text, cursor)
    if (start < 0) continue
    if (start > cursor) parts.push(<span key={`${keyPrefix}-text-${cursor}`}>{text.slice(cursor, start)}</span>)
    parts.push(<mark key={`${keyPrefix}-${highlight.id}`} className={`article-highlight highlight-${highlight.color}`}>{highlight.text}</mark>)
    cursor = start + highlight.text.length
  }
  if (cursor < text.length) parts.push(<span key={`${keyPrefix}-text-${cursor}`}>{text.slice(cursor)}</span>)
  return parts
}

function ArticleHighlightTools({ article }: { article: LawArticle }): JSX.Element {
  const data = useAppData()
  const highlights = article.highlights ?? []
  async function addHighlight(): Promise<void> {
    const selectedText = window.getSelection()?.toString().trim()
    const text = (selectedText || window.prompt('輸入要螢光標記的原文片段') || '').trim()
    if (!text || !article.text.includes(text)) return
    if (highlights.some((item) => item.text === text)) return
    await data.updateArticle({ ...article, highlights: [...highlights, { id: `highlight-${Date.now()}`, text, color: 'yellow', createdAt: new Date().toISOString() }] })
  }
  async function setMnemonic(): Promise<void> {
    const mnemonic = window.prompt('輸入口訣或諧音', article.mnemonic ?? '')
    if (mnemonic !== null) await data.updateArticle({ ...article, mnemonic: mnemonic.trim() })
  }
  async function removeHighlight(id: string): Promise<void> {
    await data.updateArticle({ ...article, highlights: highlights.filter((item) => item.id !== id) })
  }
  return <div className="article-mark-tools"><span>螢光重點：{highlights.length ? highlights.map((item) => <button type="button" className="highlight-chip" key={item.id} onClick={() => void removeHighlight(item.id)} title="點擊移除">{item.text}</button>) : <small>尚未標記</small>}</span><Button variant="ghost" onClick={() => void addHighlight()}>螢光標記</Button><Button variant="ghost" onClick={() => void setMnemonic()}>設定口訣</Button></div>
}

function ArticleStudyForm({ article, onSave, onCancel }: { article: LawArticle; onSave: (article: LawArticle) => void; onCancel: () => void }): JSX.Element {
  const [notes, setNotes] = useState(article.notes)
  const [questions, setQuestions] = useState(article.questions?.filter(Boolean) ?? [])
  const [newQuestion, setNewQuestion] = useState('')

  function addQuestion(): void {
    const question = newQuestion.trim()
    if (!question) return
    setQuestions((items) => [...items, question])
    setNewQuestion('')
  }

  return <form className="form-stack study-form" onSubmit={(event) => { event.preventDefault(); onSave({ ...article, notes: notes.trim(), questions: questions.map((question) => question.trim()).filter(Boolean) }) }}><div className="study-source"><p className="eyebrow">第 {article.articleNumber} 條</p><p>{article.text}</p></div><label>我的筆記<textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={5} placeholder="記下構成要件、法理、容易混淆之處或自己的理解……" /></label><div className="study-question-editor"><div><strong>我的考題／陷阱</strong><p className="muted-text">可記錄歷屆考題、數字陷阱或「應／得」辨析。</p></div><div className="study-question-add"><input value={newQuestion} onChange={(event) => setNewQuestion(event.target.value)} placeholder="輸入一題考題或陷阱" /><Button type="button" variant="secondary" onClick={addQuestion}>加入</Button></div>{questions.length ? <ol className="study-question-list">{questions.map((question, index) => <li key={`${index}-${question}`}><textarea value={question} onChange={(event) => setQuestions((items) => items.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} rows={2} /><button type="button" className="icon-button danger-icon" onClick={() => setQuestions((items) => items.filter((_, itemIndex) => itemIndex !== index))} aria-label={`移除第 ${index + 1} 題`}>×</button></li>)}</ol> : <span className="empty-inline">尚未加入考題</span>}</div><div className="modal-actions"><Button type="button" variant="ghost" onClick={onCancel}>取消</Button><Button type="submit">儲存筆記與考題</Button></div></form>
}

function ArticleEditForm({ article, onSave, onCancel }: { article: LawArticle; onSave: (article: LawArticle) => void; onCancel: () => void }): JSX.Element {
  const [draft, setDraft] = useState(article)
  return <form className="form-stack" onSubmit={(event) => { event.preventDefault(); onSave(draft) }}><div className="form-grid"><label>條號<input value={draft.articleNumber} onChange={(event) => setDraft({ ...draft, articleNumber: event.target.value })} required /></label><label>標題<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label><label>重要程度<select value={draft.importance} onChange={(event) => setDraft({ ...draft, importance: Number(event.target.value) as 1 | 2 | 3 | 4 | 5 })}>{[1, 2, 3, 4, 5].map((value) => <option value={value} key={value}>{value}</option>)}</select></label></div>{draft.source && <Notice tone="info">此條文由<a href={draft.source.lawUrl} target="_blank" rel="noreferrer">法務部全國法規資料庫 ↗</a>匯入；編輯後請自行確認內容正確性。</Notice>}<label>法條全文<textarea className="article-edit-textarea" value={draft.text} onChange={(event) => setDraft({ ...draft, text: event.target.value })} rows={9} required /></label><label>備註<textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} rows={2} /></label><div className="preview-checks"><label className="checkbox-row"><input type="checkbox" checked={draft.mustMemorize} onChange={(event) => setDraft({ ...draft, mustMemorize: event.target.checked })} /> 必背法條</label><label className="checkbox-row"><input type="checkbox" checked={draft.includeDaily} onChange={(event) => setDraft({ ...draft, includeDaily: event.target.checked })} /> 加入每日任務</label><label className="checkbox-row"><input type="checkbox" checked={draft.isBoss} onChange={(event) => setDraft({ ...draft, isBoss: event.target.checked })} /> 魔王法條</label></div><div className="modal-actions"><Button variant="ghost" onClick={onCancel}>取消</Button><Button type="submit">儲存變更</Button></div></form>
}

function emptyDraft(): ImportArticleDraft {
  return { articleNumber: '', title: '', text: '', notes: '', importance: 3, mustMemorize: false, includeDaily: true }
}

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase('zh-Hant').replace(/[\s　]/g, '')
}

function asExamSubject(value: string | null): ExamSubject | undefined {
  return value && (value in EXAM_SUBJECT_LABELS) ? value as ExamSubject : undefined
}
