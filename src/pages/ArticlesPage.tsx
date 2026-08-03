import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ExamPresetImporter } from '../components/ExamPresetImporter'
import { OfficialLawImporter } from '../components/OfficialLawImporter'
import { Button, EmptyState, Modal, Notice, PageHeader, ProgressBar, Stars, StatusBadge } from '../components/ui'
import { useAppData } from '../context/AppContext'
import type { ImportArticleDraft, LawArticle } from '../types'
import type { OfficialLawDataSource, OfficialLawSummary } from '../lib/officialLaws'
import { POLICE_SERGEANT_EXAM_PRESET, type ExamPresetBundle, type ExamPresetImportResult } from '../lib/examPreset'
import { parseJsonImport, splitLawText } from '../lib/importer'
import { formatDateTimeTW } from '../lib/utils'

type ImportKind = 'official' | 'text' | 'json'

export function ArticlesPage(): JSX.Element {
  const data = useAppData()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeLaws = data.laws.filter((law) => !law.deletedAt)
  const [selectedLawId, setSelectedLawId] = useState(searchParams.get('law') ?? activeLaws[0]?.id ?? '')
  const [input, setInput] = useState('')
  const [importKind, setImportKind] = useState<ImportKind>('official')
  const [preview, setPreview] = useState<ImportArticleDraft[]>([])
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<LawArticle | null>(null)
  const [viewing, setViewing] = useState<LawArticle | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const selectedLaw = activeLaws.find((law) => law.id === selectedLawId)
  const presetLawNames = useMemo(() => new Set(POLICE_SERGEANT_EXAM_PRESET.laws.map((law) => normalizeName(law.name))), [])
  const presetLaws = activeLaws.filter((law) => presetLawNames.has(normalizeName(law.name)))
  const presetLawIds = new Set(presetLaws.map((law) => law.id))
  const presetArticleCount = data.articles.filter((article) => !article.deletedAt && presetLawIds.has(article.lawId)).length
  const articles = useMemo(() => data.articles.filter((article) => article.lawId === selectedLawId
    && !article.deletedAt
    && (article.articleNumber.includes(search) || article.text.includes(search) || article.title.includes(search))), [data.articles, search, selectedLawId])
  const importPlaceholder = importKind === 'text'
    ? '例如：\n第1條\n法條內容……\n\n第 2 條\n下一條內容……'
    : '{"articles":[{"articleNumber":"1","text":"法條內容"}]}'
  const officialPreview = preview.some((draft) => draft.source?.type === 'moj-law')

  function changeLaw(id: string): void {
    setSelectedLawId(id)
    setSearchParams(id ? { law: id } : {})
  }

  function generatePreview(): void {
    setError('')
    setMessage('')
    if (!selectedLawId) { setError('請先建立並選擇一部法規。'); return }
    if (!input.trim()) { setError('請貼上法條文字或選擇匯入檔案。'); return }
    try {
      const drafts = importKind === 'json' ? parseJsonImport(input) : splitLawText(input)
      if (!drafts.length) throw new Error('沒有拆出任何法條，請確認內容包含「第○條」格式。')
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
      setImportKind(file.name.toLowerCase().endsWith('.json') ? 'json' : 'text')
      setMessage(`已讀取 ${file.name}，按「產生預覽」檢查拆分結果。`)
    } catch {
      setError('檔案讀取失敗，請確認檔案仍可存取。')
    }
    event.target.value = ''
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
        importance: 3,
        examScope: true,
        notes: `由法務部全國法規資料庫建立；官方資料更新日期：${source.dataUpdatedAt}。`,
        source: drafts[0]?.source,
      })
    }
    changeLaw(target.id)
    setPreview(drafts)
    setMessage(`已將「${law.name}」的 ${drafts.length} 條官方條文放入預覽，確認原文後再儲存。`)
    window.setTimeout(() => document.getElementById('import-preview')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }

  async function importExamPreset(bundle: ExamPresetBundle): Promise<ExamPresetImportResult> {
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
      description="可從全國法規資料庫挑選條文，或匯入 TXT、JSON；確認預覽後才寫入本機 IndexedDB。"
      actions={selectedLawId && <Button variant="secondary" onClick={() => setPreview((items) => [...items, emptyDraft()])}>＋ 手動新增</Button>}
    />
    {error && <Notice tone="warning">{error}</Notice>}
    {message && <Notice tone="success">{message}</Notice>}

    <section className="import-workbench card">
      <div className="workbench-head">
        <div><p className="eyebrow">IMPORT / 法條匯入</p><h2>{importKind === 'official' ? '從官方資料庫挑選' : '匯入自己的法條'}</h2></div>
        {importKind !== 'official' && activeLaws.length > 0 && <div className="law-select-wrap"><label>匯入至<select value={selectedLawId} onChange={(event) => changeLaw(event.target.value)}>{activeLaws.map((law) => <option value={law.id} key={law.id}>{law.name}</option>)}</select></label></div>}
      </div>
      <div className="import-tabs" role="tablist" aria-label="匯入方式">
        <button type="button" role="tab" aria-selected={importKind === 'official'} className={importKind === 'official' ? 'selected' : ''} onClick={() => setImportKind('official')}>全國法規資料庫</button>
        <button type="button" role="tab" aria-selected={importKind === 'text'} className={importKind === 'text' ? 'selected' : ''} onClick={() => setImportKind('text')}>貼上純文字 / TXT</button>
        <button type="button" role="tab" aria-selected={importKind === 'json'} className={importKind === 'json' ? 'selected' : ''} onClick={() => setImportKind('json')}>JSON</button>
      </div>
      {importKind === 'official'
        ? <div className="official-import-stack"><ExamPresetImporter existingLawCount={presetLaws.length} existingArticleCount={presetArticleCount} onImport={importExamPreset} /><OfficialLawImporter localLaws={activeLaws} localArticles={data.articles} onPrepare={prepareOfficialImport} /></div>
        : activeLaws.length
          ? <div className="manual-import-panel"><textarea className="import-textarea" value={input} onChange={(event) => setInput(event.target.value)} placeholder={importPlaceholder} /><div className="import-actions"><input ref={fileInput} type="file" accept=".txt,.json,text/plain,application/json" hidden onChange={(event) => void readFile(event)} /><Button variant="secondary" onClick={() => fileInput.current?.click()}>選擇檔案</Button><Button onClick={generatePreview}>產生拆分預覽</Button></div></div>
          : <Notice tone="warning"><div>TXT 與 JSON 必須先指定本機法規；你也可以切回「全國法規資料庫」，系統會在選取條文時自動建立法規。</div><Button variant="ghost" onClick={() => navigate('/laws')}>前往法規管理</Button></Notice>}
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

    {selectedLaw ? <section className="article-browser">
      <div className="section-toolbar"><div><p className="eyebrow">BROWSER / {selectedLaw.shortName}</p><h2>已儲存法條 <span className="count-chip">{articles.length}</span></h2></div><label className="search-box"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜尋條號、標題或文字" /></label></div>
      {articles.length ? <div className="article-list">{articles.map((article) => <ArticleRow key={article.id} article={article} onView={() => setViewing(article)} onEdit={() => setEditing(article)} onTrain={() => navigate(`/training/${article.id}`)} onDelete={() => void removeArticle(article)} />)}</div> : <EmptyState icon="≡" title="這部法規還沒有法條" description="從官方資料庫勾選條文，或貼上文字並產生預覽。" />}
    </section> : <EmptyState icon="⌕" title="先搜尋並選擇法條" description="上方可直接搜尋全國法規資料庫；選好條文後，系統會自動建立對應的本機法規。" />}

    {viewing && <Modal title={`${selectedLaw?.shortName ?? ''} · 第 ${viewing.articleNumber} 條`} onClose={() => setViewing(null)}><div className="article-view"><div className="article-view-meta"><Stars value={viewing.importance} />{viewing.mustMemorize && <span className="must-tag">必背</span>}{viewing.source && <span className="official-source-badge">官方匯入</span>}<span>更新於 {formatDateTimeTW(viewing.updatedAt)}</span></div><p className="article-original">{viewing.text}</p>{viewing.source && <Notice tone="info">來源：<a href={viewing.source.lawUrl} target="_blank" rel="noreferrer">法務部全國法規資料庫 ↗</a>；資料更新 {viewing.source.dataUpdatedAt}，匯入 {formatDateTimeTW(viewing.source.retrievedAt)}。</Notice>}{viewing.notes && <Notice tone="info">備註：{viewing.notes}</Notice>}<div className="modal-actions"><Button variant="ghost" onClick={() => { setViewing(null); setEditing(viewing) }}>編輯</Button><Button onClick={() => navigate(`/training/${viewing.id}`)}>開始訓練</Button></div></div></Modal>}
    {editing && <Modal title={`編輯第 ${editing.articleNumber} 條`} onClose={() => setEditing(null)}><ArticleEditForm article={editing} onCancel={() => setEditing(null)} onSave={(article) => void saveArticle(article)} /></Modal>}
  </div>
}

function ArticleRow({ article, onView, onEdit, onTrain, onDelete }: { article: LawArticle; onView: () => void; onEdit: () => void; onTrain: () => void; onDelete: () => void }): JSX.Element {
  const data = useAppData()
  const mastery = data.mastery.find((item) => item.articleId === article.id)
  return <article className="article-row card"><div className="article-number">第<strong>{article.articleNumber}</strong>條</div><div className="article-row-body"><div className="article-row-title"><h3>{article.title || '未命名條文'}</h3><span className="article-preview">{article.text.slice(0, 120)}{article.text.length > 120 ? '…' : ''}</span></div><div className="article-row-tags">{article.mustMemorize && <span className="must-tag">必背</span>}{article.isBoss && <span className="boss-tag">魔王</span>}{article.source && <span className="official-source-badge">官方匯入</span>}<StatusBadge status={mastery?.status ?? '未開始'} /></div></div><div className="article-row-progress"><strong>{Math.round(mastery?.score ?? 0)}%</strong><ProgressBar value={mastery?.score ?? 0} showValue={false} tone={(mastery?.score ?? 0) >= 80 ? 'green' : 'blue'} /></div><div className="row-actions"><Button variant="secondary" onClick={onTrain}>訓練</Button><Button variant="ghost" onClick={onView}>查看</Button><Button variant="ghost" onClick={onEdit}>編輯</Button><button className="icon-button danger-icon" onClick={onDelete} aria-label="封存法條">×</button></div></article>
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
