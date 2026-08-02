import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Button, EmptyState, Modal, Notice, PageHeader, ProgressBar, Stars, StatusBadge } from '../components/ui'
import { useAppData } from '../context/AppContext'
import type { ImportArticleDraft, LawArticle } from '../types'
import { articleToDraft, parseJsonImport, splitLawText } from '../lib/importer'
import { formatDateTimeTW } from '../lib/utils'

export function ArticlesPage(): JSX.Element {
  const data = useAppData()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeLaws = data.laws.filter((law) => !law.deletedAt)
  const [selectedLawId, setSelectedLawId] = useState(searchParams.get('law') ?? activeLaws[0]?.id ?? '')
  const [input, setInput] = useState('')
  const [importKind, setImportKind] = useState<'text' | 'json'>('text')
  const [preview, setPreview] = useState<ImportArticleDraft[]>([])
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<LawArticle | null>(null)
  const [viewing, setViewing] = useState<LawArticle | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const selectedLaw = activeLaws.find((law) => law.id === selectedLawId)
  const articles = data.articles.filter((article) => article.lawId === selectedLawId && !article.deletedAt && (article.articleNumber.includes(search) || article.text.includes(search) || article.title.includes(search)))
  const importPlaceholder = importKind === 'text' ? '例如：\n第1條\n法條內容……\n\n第 2 條\n下一條內容……' : '{"articles":[{"articleNumber":"1","text":"法條內容"}]}'

  function changeLaw(id: string): void { setSelectedLawId(id); setSearchParams(id ? { law: id } : {}) }

  function generatePreview(): void {
    setError(''); setMessage('')
    if (!selectedLawId) { setError('請先建立並選擇一部法規。'); return }
    if (!input.trim()) { setError('請貼上法條文字或選擇匯入檔案。'); return }
    try {
      const drafts = importKind === 'json' ? parseJsonImport(input) : splitLawText(input)
      if (!drafts.length) throw new Error('沒有拆出任何法條，請確認內容包含「第○條」格式。')
      setPreview(drafts)
      setMessage(`已拆分 ${drafts.length} 條，請在下方預覽確認後儲存。`)
    } catch (caught) { setError(caught instanceof Error ? caught.message : '法條拆分失敗。') }
  }

  async function readFile(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      setInput(text)
      setImportKind(file.name.toLowerCase().endsWith('.json') ? 'json' : 'text')
      setMessage(`已讀取 ${file.name}，按「產生預覽」檢查拆分結果。`)
    } catch { setError('檔案讀取失敗，請確認檔案仍可存取。') }
    event.target.value = ''
  }

  function updateDraft(index: number, patch: Partial<ImportArticleDraft>): void { setPreview((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item)) }

  async function savePreview(): Promise<void> {
    try { await data.saveImportedArticles(selectedLawId, preview); setPreview([]); setInput(''); setMessage(`已儲存 ${preview.length} 條法條。`) } catch (caught) { setError(caught instanceof Error ? caught.message : '法條儲存失敗。') }
  }

  async function saveArticle(article: LawArticle): Promise<void> {
    try { await data.updateArticle(article); setEditing(null); setMessage(`第 ${article.articleNumber} 條已更新。`) } catch (caught) { setError(caught instanceof Error ? caught.message : '法條更新失敗。') }
  }

  async function removeArticle(article: LawArticle): Promise<void> {
    if (!window.confirm(`確定要刪除第 ${article.articleNumber} 條嗎？作答紀錄會保留。`)) return
    try { await data.deleteArticle(article.id); setMessage(`第 ${article.articleNumber} 條已封存。`) } catch (caught) { setError(caught instanceof Error ? caught.message : '法條刪除失敗。') }
  }

  return <div className="page-stack">
    <PageHeader eyebrow="LIBRARY / LAW ARTICLES" title="法條瀏覽" description="匯入時先拆分、預覽、修改；確認後才會寫入 IndexedDB。原始文字會完整保留。" actions={selectedLawId && <Button variant="secondary" onClick={() => setPreview((items) => [...items, { articleNumber: '', title: '', text: '', notes: '', importance: 3, mustMemorize: false, includeDaily: true }])}>＋ 手動新增</Button>} />
    {error && <Notice tone="warning">{error}</Notice>}{message && <Notice tone="success">{message}</Notice>}
    {!activeLaws.length ? <EmptyState icon="≡" title="請先建立法規" description="法條必須隸屬於一部法規，建立後即可匯入 TXT、JSON 或貼上純文字。" action={<Button onClick={() => navigate('/laws')}>前往法規管理</Button>} /> : <>
      <section className="import-workbench card"><div className="workbench-head"><div><p className="eyebrow">IMPORT / 原文匯入</p><h2>匯入法條</h2></div><div className="law-select-wrap"><label>匯入至<select value={selectedLawId} onChange={(event) => changeLaw(event.target.value)}>{activeLaws.map((law) => <option value={law.id} key={law.id}>{law.name}</option>)}</select></label></div></div><div className="import-tabs"><button className={importKind === 'text' ? 'selected' : ''} onClick={() => setImportKind('text')}>貼上純文字 / TXT</button><button className={importKind === 'json' ? 'selected' : ''} onClick={() => setImportKind('json')}>JSON</button></div><textarea className="import-textarea" value={input} onChange={(event) => setInput(event.target.value)} placeholder={importPlaceholder} /><div className="import-actions"><input ref={fileInput} type="file" accept=".txt,.json,text/plain,application/json" hidden onChange={(event) => void readFile(event)} /><Button variant="secondary" onClick={() => fileInput.current?.click()}>選擇檔案</Button><Button onClick={generatePreview}>產生拆分預覽</Button></div></section>
      {preview.length > 0 && <section className="preview-section card"><div className="card-heading"><div><p className="eyebrow">PREVIEW / 待確認</p><h2>拆分預覽 <span className="count-chip">{preview.length}</span></h2></div><div className="card-actions"><Button variant="ghost" onClick={() => setPreview([])}>清除預覽</Button><Button onClick={() => void savePreview()}>確認並儲存</Button></div></div><Notice tone="warning">這是儲存前預覽。請確認條號與原文，系統不會自行補正正式法規內容。</Notice><div className="preview-list">{preview.map((draft, index) => <div className="preview-row" key={`${index}-${draft.articleNumber}`}><div className="preview-index">{String(index + 1).padStart(2, '0')}</div><div className="preview-fields"><div className="preview-inline"><label>條號<input value={draft.articleNumber} onChange={(event) => updateDraft(index, { articleNumber: event.target.value })} /></label><label>標題<input value={draft.title} onChange={(event) => updateDraft(index, { title: event.target.value })} placeholder="可留白" /></label><label>重要程度<select value={draft.importance} onChange={(event) => updateDraft(index, { importance: Number(event.target.value) as 1 | 2 | 3 | 4 | 5 })}>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}</select></label></div><textarea value={draft.text} onChange={(event) => updateDraft(index, { text: event.target.value })} rows={4} /><div className="preview-checks"><label className="checkbox-row"><input type="checkbox" checked={draft.mustMemorize} onChange={(event) => updateDraft(index, { mustMemorize: event.target.checked })} /> 必背</label><label className="checkbox-row"><input type="checkbox" checked={draft.includeDaily} onChange={(event) => updateDraft(index, { includeDaily: event.target.checked })} /> 加入每日任務</label></div></div><button className="icon-button danger-icon" onClick={() => setPreview((items) => items.filter((_, itemIndex) => itemIndex !== index))} aria-label="移除預覽項目">×</button></div>)}</div></section>}
      <section className="article-browser"><div className="section-toolbar"><div><p className="eyebrow">BROWSER / {selectedLaw?.shortName ?? '法條'}</p><h2>已儲存法條 <span className="count-chip">{articles.length}</span></h2></div><label className="search-box"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜尋條號、標題或文字" /></label></div>{articles.length ? <div className="article-list">{articles.map((article) => <ArticleRow key={article.id} article={article} onView={() => setViewing(article)} onEdit={() => setEditing(article)} onTrain={() => navigate(`/training/${article.id}`)} onDelete={() => void removeArticle(article)} />)}</div> : <EmptyState icon="≡" title="這部法規還沒有法條" description="貼上文字並產生預覽，確認後就會出現在這裡。" />}</section>
    </>}
    {viewing && <Modal title={`${selectedLaw?.shortName ?? ''} · 第 ${viewing.articleNumber} 條`} onClose={() => setViewing(null)}><div className="article-view"><div className="article-view-meta"><Stars value={viewing.importance} />{viewing.mustMemorize && <span className="must-tag">必背</span>}<span>更新於 {formatDateTimeTW(viewing.updatedAt)}</span></div><p className="article-original">{viewing.text}</p>{viewing.notes && <Notice tone="info">備註：{viewing.notes}</Notice>}<div className="modal-actions"><Button variant="ghost" onClick={() => { setViewing(null); setEditing(viewing) }}>編輯</Button><Button onClick={() => navigate(`/training/${viewing.id}`)}>開始訓練</Button></div></div></Modal>}
    {editing && <Modal title={`編輯第 ${editing.articleNumber} 條`} onClose={() => setEditing(null)}><ArticleEditForm article={editing} onCancel={() => setEditing(null)} onSave={(article) => void saveArticle(article)} /></Modal>}
  </div>
}

function ArticleRow({ article, onView, onEdit, onTrain, onDelete }: { article: LawArticle; onView: () => void; onEdit: () => void; onTrain: () => void; onDelete: () => void }): JSX.Element {
  const data = useAppData()
  const mastery = data.mastery.find((item) => item.articleId === article.id)
  return <article className="article-row card"><div className="article-number">第<strong>{article.articleNumber}</strong>條</div><div className="article-row-body"><div className="article-row-title"><h3>{article.title || '未命名條文'}</h3><span className="article-preview">{article.text.slice(0, 120)}{article.text.length > 120 ? '…' : ''}</span></div><div className="article-row-tags">{article.mustMemorize && <span className="must-tag">必背</span>}{article.isBoss && <span className="boss-tag">魔王</span>}<StatusBadge status={mastery?.status ?? '未開始'} /></div></div><div className="article-row-progress"><strong>{Math.round(mastery?.score ?? 0)}%</strong><ProgressBar value={mastery?.score ?? 0} showValue={false} tone={(mastery?.score ?? 0) >= 80 ? 'green' : 'blue'} /></div><div className="row-actions"><Button variant="secondary" onClick={onTrain}>訓練</Button><Button variant="ghost" onClick={onView}>查看</Button><Button variant="ghost" onClick={onEdit}>編輯</Button><button className="icon-button danger-icon" onClick={onDelete} aria-label="封存法條">×</button></div></article>
}

function ArticleEditForm({ article, onSave, onCancel }: { article: LawArticle; onSave: (article: LawArticle) => void; onCancel: () => void }): JSX.Element {
  const [draft, setDraft] = useState(article)
  return <form className="form-stack" onSubmit={(event) => { event.preventDefault(); onSave(draft) }}><div className="form-grid"><label>條號<input value={draft.articleNumber} onChange={(event) => setDraft({ ...draft, articleNumber: event.target.value })} required /></label><label>標題<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label><label>重要程度<select value={draft.importance} onChange={(event) => setDraft({ ...draft, importance: Number(event.target.value) as 1 | 2 | 3 | 4 | 5 })}>{[1, 2, 3, 4, 5].map((value) => <option value={value} key={value}>{value}</option>)}</select></label></div><label>法條全文<textarea className="article-edit-textarea" value={draft.text} onChange={(event) => setDraft({ ...draft, text: event.target.value })} rows={9} required /></label><label>備註<textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} rows={2} /></label><div className="preview-checks"><label className="checkbox-row"><input type="checkbox" checked={draft.mustMemorize} onChange={(event) => setDraft({ ...draft, mustMemorize: event.target.checked })} /> 必背法條</label><label className="checkbox-row"><input type="checkbox" checked={draft.includeDaily} onChange={(event) => setDraft({ ...draft, includeDaily: event.target.checked })} /> 加入每日任務</label><label className="checkbox-row"><input type="checkbox" checked={draft.isBoss} onChange={(event) => setDraft({ ...draft, isBoss: event.target.checked })} /> 魔王法條</label></div><div className="modal-actions"><Button variant="ghost" onClick={onCancel}>取消</Button><Button type="submit">儲存變更</Button></div></form>
}
