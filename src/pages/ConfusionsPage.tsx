import { useMemo, useState } from 'react'
import { useAppData } from '../context/AppContext'
import { Button, EmptyState, Modal, Notice, PageHeader } from '../components/ui'
import { compareText } from '../lib/compare'

const reasons = ['得與應', '要件不同', '法律效果不同', '主體不同', '時間不同', '數字不同', '程序不同', '例外不同', '其他']

export function ConfusionsPage(): JSX.Element {
  const data = useAppData()
  const [showCreate, setShowCreate] = useState(false)
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const articles = data.articles.filter((article) => !article.deletedAt)
  const selectedGroup = data.confusions.find((group) => group.id === selectedGroupId)
  return <div className="page-stack"><PageHeader eyebrow="CONFUSION / CONTRAST" title="易混淆法條" description="手動建立對照組，讓系統把不同法條放在同一個比較畫面；不會自動臆測法條關係。" actions={<Button onClick={() => setShowCreate(true)}>＋ 建立混淆組</Button>} />{message && <Notice tone="success">{message}</Notice>}{data.confusions.length ? <div className="confusion-layout"><div className="confusion-list">{data.confusions.map((group) => <button key={group.id} className={`confusion-list-row ${selectedGroupId === group.id ? 'active' : ''}`} onClick={() => setSelectedGroupId(group.id)}><span className="confusion-symbol">⇄</span><span><strong>{group.name}</strong><small>{group.articleIds.length} 條 · {group.reason}</small></span><span>→</span></button>)}</div><div className="confusion-detail card">{selectedGroup ? <ConfusionDetail group={selectedGroup} /> : <EmptyState icon="⇄" title="選擇一個對照組" description="左側選擇混淆組後，會顯示法條差異。" />}</div></div> : <EmptyState icon="⇄" title="尚無易混淆法條組" description="例如把兩條容易混淆的法條加入同一組，並記下混淆原因。" action={<Button onClick={() => setShowCreate(true)}>建立第一組</Button>} />}{showCreate && <Modal title="建立易混淆法條組" onClose={() => setShowCreate(false)}><ConfusionForm articles={articles} onCancel={() => setShowCreate(false)} onSave={async (input) => { try { await data.createConfusionGroup(input); setShowCreate(false); setMessage('易混淆法條組已建立。') } catch (error) { setMessage(error instanceof Error ? error.message : '建立混淆組失敗。') } }} /></Modal>}</div>
}

function ConfusionDetail({ group }: { group: { name: string; reason: string; notes: string; articleIds: string[] } }): JSX.Element {
  const data = useAppData()
  const groupArticles = group.articleIds.map((id) => data.articles.find((article) => article.id === id)).filter((article): article is NonNullable<typeof article> => Boolean(article))
  return <div><div className="confusion-detail-head"><div><p className="eyebrow">CONTRAST / {group.reason}</p><h2>{group.name}</h2>{group.notes && <p className="muted">{group.notes}</p>}</div><span className="count-chip">{groupArticles.length} 條</span></div>{groupArticles.length >= 2 ? <div className="contrast-grid">{groupArticles.slice(0, 3).map((article, index) => <div className="contrast-column" key={article.id}><div className="contrast-title"><span>條文 {index + 1}</span><strong>第 {article.articleNumber} 條</strong></div><p>{article.text}</p></div>)}</div> : <Notice tone="warning">這組目前找不到足夠的法條，可能已被封存。</Notice>}<p className="muted">提示：對照畫面保留原文，不會自行判定哪一條是正確答案；可以從任一法條進入訓練模式。</p></div>
}

function ConfusionForm({ articles, onSave, onCancel }: { articles: Array<{ id: string; lawId: string; articleNumber: string; text: string }>; onSave: (input: { name: string; reason: string; articleIds: string[]; notes: string }) => Promise<void>; onCancel: () => void }): JSX.Element {
  const data = useAppData()
  const [name, setName] = useState('')
  const [reason, setReason] = useState(reasons[0])
  const [notes, setNotes] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const [error, setError] = useState('')
  const submit = async (event: React.FormEvent): Promise<void> => { event.preventDefault(); if (selected.length < 2) { setError('至少選擇兩條法條。'); return } if (!name.trim()) { setError('請輸入混淆組名稱。'); return } await onSave({ name, reason, articleIds: selected, notes }) }
  return <form className="form-stack" onSubmit={(event) => void submit(event)}><label>組名稱<input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：得／應用語對照" /></label><label>混淆原因<select value={reason} onChange={(event) => setReason(event.target.value)}>{reasons.map((item) => <option key={item}>{item}</option>)}</select></label><label>備註<textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} /></label><div><p className="form-label">選擇法條（已選 {selected.length} 條）</p><div className="article-picker">{articles.map((article) => { const law = data.laws.find((item) => item.id === article.lawId); return <label className="picker-row" key={article.id}><input type="checkbox" checked={selected.includes(article.id)} onChange={(event) => setSelected((current) => event.target.checked ? [...current, article.id] : current.filter((id) => id !== article.id))} /><span>{law?.shortName} · 第 {article.articleNumber} 條</span></label> })}</div></div>{error && <p className="form-error">{error}</p>}<div className="modal-actions"><Button variant="ghost" onClick={onCancel}>取消</Button><Button type="submit">建立對照組</Button></div></form>
}
