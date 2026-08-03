import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, EmptyState, Modal, Notice, PageHeader, ProgressBar, Stars } from '../components/ui'
import { useAppData } from '../context/AppContext'
import type { LawCollection } from '../types'
import { formatDateTW } from '../lib/utils'

const examCategories = ['憲法', '警察法規', '刑法', '刑事訴訟法']
const categories = [...examCategories, '其他']

export function LawsPage(): JSX.Element {
  const data = useAppData()
  const [showCreate, setShowCreate] = useState(false)
  const [editing, setEditing] = useState<LawCollection | null>(null)
  const [message, setMessage] = useState('')
  const laws = data.laws.filter((law) => !law.deletedAt)
  const lawGroups = useMemo(() => {
    const groups = examCategories.map((category) => ({ category, laws: laws.filter((law) => law.category === category) }))
    const otherLaws = laws.filter((law) => !examCategories.includes(law.category))
    if (otherLaws.length) groups.push({ category: '其他', laws: otherLaws })
    return groups.filter((group) => group.laws.length)
  }, [laws])

  async function removeLaw(law: LawCollection): Promise<void> {
    if (!window.confirm(`確定要刪除「${law.name}」嗎？系統會採封存方式保留相關作答證據。`)) return
    try { await data.deleteLaw(law.id); setMessage(`已封存「${law.name}」。`) } catch (error) { setMessage(error instanceof Error ? error.message : '操作失敗。') }
  }

  return <div className="page-stack">
    <PageHeader eyebrow="LIBRARY / 法規資料庫" title="法規管理" description="可手動建立法規，或到法條瀏覽頁搜尋全國法規資料庫並挑選條文。" actions={<Button onClick={() => setShowCreate(true)}>＋ 建立法規</Button>} />
    {message && <Notice tone="info">{message}</Notice>}
    <div className="library-summary"><div><span>啟用法規</span><strong>{laws.length}</strong></div><div><span>已匯入法條</span><strong>{data.articles.filter((article) => !article.deletedAt).length}</strong></div><div><span>考試範圍</span><strong>{laws.filter((law) => law.examScope).length}</strong></div><div><span>高重要度</span><strong>{laws.filter((law) => law.importance >= 4).length}</strong></div></div>
    {laws.length ? <div className="law-category-stack">{lawGroups.map((group) => <section className="law-category-section" key={group.category}><div className="law-category-heading"><div><p className="eyebrow">EXAM SUBJECT / 考科</p><h2>{group.category}</h2></div><span>{group.laws.length} 部法規 · {data.articles.filter((article) => !article.deletedAt && group.laws.some((law) => law.id === article.lawId)).length.toLocaleString('zh-TW')} 條</span></div><div className="law-grid">{group.laws.map((law) => <LawCard key={law.id} law={law} onEdit={() => setEditing(law)} onDelete={() => void removeLaw(law)} />)}</div></section>)}</div> : <EmptyState icon="⌘" title="還沒有法規資料" description="建立法規後，再到法條瀏覽頁貼上或匯入法條。" action={<Button onClick={() => setShowCreate(true)}>建立第一部法規</Button>} />}
    {showCreate && <Modal title="建立法規" onClose={() => setShowCreate(false)}><LawForm onSubmit={async (input) => { try { await data.createLaw(input); setShowCreate(false); setMessage('法規已建立。') } catch (error) { setMessage(error instanceof Error ? error.message : '建立法規失敗。') } }} onCancel={() => setShowCreate(false)} /></Modal>}
    {editing && <Modal title="編輯法規" onClose={() => setEditing(null)}><LawForm initial={editing} onSubmit={async (input) => { try { await data.updateLaw({ ...editing, ...input }); setEditing(null); setMessage('法規已更新。') } catch (error) { setMessage(error instanceof Error ? error.message : '更新法規失敗。') } }} onCancel={() => setEditing(null)} /></Modal>}
  </div>
}

function LawCard({ law, onEdit, onDelete }: { law: LawCollection; onEdit: () => void; onDelete: () => void }): JSX.Element {
  const data = useAppData()
  const articles = data.articles.filter((article) => article.lawId === law.id && !article.deletedAt)
  const mastered = articles.filter((article) => data.mastery.find((item) => item.articleId === article.id)?.status === '已精通').length
  const average = articles.length ? articles.reduce((sum, article) => sum + (data.mastery.find((item) => item.articleId === article.id)?.score ?? 0), 0) / articles.length : 0
  return <article className="law-card card"><div className="law-card-head"><div className="law-symbol">§</div><div className="law-card-title"><div><h2>{law.name}</h2><span>{law.shortName} · {law.category}</span></div><div className="law-card-badges">{law.examScope && <span className="scope-tag">考試範圍</span>}{law.source && <a className="official-source-badge" href={law.source.lawUrl} target="_blank" rel="noreferrer">官方來源 ↗</a>}</div></div></div><div className="law-meta"><span>建立於 {formatDateTW(law.createdAt)}</span><Stars value={law.importance} /></div><ProgressBar value={average} label="整體熟練度" tone={average >= 80 ? 'green' : 'blue'} /><div className="law-card-stats"><div><strong>{articles.length}</strong><span>法條</span></div><div><strong>{mastered}</strong><span>已精通</span></div><div><strong>{Math.round(average)}%</strong><span>平均</span></div></div>{law.notes && <p className="law-note">{law.notes}</p>}<div className="card-actions"><Link className="button button-primary" to={`/systems/${law.id}`}>體系圖</Link><Link className="button button-secondary" to={`/articles?law=${law.id}`}>管理法條</Link><Button variant="ghost" onClick={onEdit}>編輯</Button><Button variant="ghost" onClick={onDelete}>封存</Button></div></article>
}

function LawForm({ initial, onSubmit, onCancel }: { initial?: LawCollection; onSubmit: (input: { name: string; shortName: string; category: string; importance: 1 | 2 | 3 | 4 | 5; examScope: boolean; notes: string }) => Promise<void>; onCancel: () => void }): JSX.Element {
  const [name, setName] = useState(initial?.name ?? '')
  const [shortName, setShortName] = useState(initial?.shortName ?? '')
  const [category, setCategory] = useState(initial?.category ?? categories[0])
  const categoryOptions = initial?.category && !categories.includes(initial.category) ? [initial.category, ...categories] : categories
  const [importance, setImportance] = useState<1 | 2 | 3 | 4 | 5>(initial?.importance ?? 3)
  const [examScope, setExamScope] = useState(initial?.examScope ?? true)
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [busy, setBusy] = useState(false)
  const [formError, setFormError] = useState('')
  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault()
    if (!name.trim()) { setFormError('請輸入法規名稱。'); return }
    setBusy(true); setFormError('')
    try { await onSubmit({ name, shortName, category, importance, examScope, notes }) } finally { setBusy(false) }
  }
  return <form className="form-stack" onSubmit={(event) => void submit(event)}><div className="form-grid"><label>法規名稱<input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：警察職權行使法" required /></label><label>簡稱<input value={shortName} onChange={(event) => setShortName(event.target.value)} placeholder="例如：警職法" /></label><label>分類<select value={category} onChange={(event) => setCategory(event.target.value)}>{categoryOptions.map((item) => <option key={item}>{item}</option>)}</select></label><label>重要程度<select value={importance} onChange={(event) => setImportance(Number(event.target.value) as 1 | 2 | 3 | 4 | 5)}>{[1, 2, 3, 4, 5].map((item) => <option value={item} key={item}>{item} / 5</option>)}</select></label></div><label className="checkbox-row"><input type="checkbox" checked={examScope} onChange={(event) => setExamScope(event.target.checked)} /> 列入考試範圍</label><label>備註<textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="可記錄版本或來源備註，不會修改法條原文。" /></label>{formError && <p className="form-error">{formError}</p>}<div className="modal-actions"><Button variant="ghost" onClick={onCancel}>取消</Button><Button type="submit" disabled={busy}>{busy ? '儲存中…' : initial ? '儲存變更' : '建立法規'}</Button></div></form>
}
