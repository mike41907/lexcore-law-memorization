import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, EmptyState, PageHeader, ProgressBar, StatusBadge } from '../components/ui'
import { useAppData } from '../context/AppContext'
import type { KnowledgeMastery, KnowledgePoint, KnowledgePointType, LawArticle } from '../types'
import { KNOWLEDGE_POINT_TYPE_LABELS } from '../lib/knowledgePointEngine'

export function KnowledgeDashboardPage(): JSX.Element {
  const data = useAppData()
  const navigate = useNavigate()
  const [lawFilter, setLawFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState<'all' | KnowledgePointType>('all')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string[]>([])
  const activeArticles = data.articles.filter((article) => !article.deletedAt)
  const activeLaws = data.laws.filter((law) => !law.deletedAt)
  const articleMap = new Map(activeArticles.map((article) => [article.id, article]))
  const masteryMap = new Map(data.knowledgeMastery.map((item) => [item.knowledgePointId, item]))
  const questionCountMap = new Map<string, number>()
  data.knowledgeQuestions.forEach((question) => questionCountMap.set(question.knowledgePointId, (questionCountMap.get(question.knowledgePointId) ?? 0) + 1))
  const points = useMemo(() => data.knowledgePoints.filter((point) => {
    const article = articleMap.get(point.articleId)
    const text = `${point.name} ${point.originalSentence} ${point.keywords.join(' ')}`.toLocaleLowerCase('zh-Hant')
    return !point.deletedAt && article && (lawFilter === 'all' || article.lawId === lawFilter) && (typeFilter === 'all' || point.type === typeFilter) && (!query.trim() || text.includes(query.trim().toLocaleLowerCase('zh-Hant')))
  }).sort((left, right) => (masteryMap.get(left.id)?.score ?? 0) - (masteryMap.get(right.id)?.score ?? 0)), [articleMap, data.knowledgePoints, lawFilter, masteryMap, query, typeFilter])
  const dueCount = data.knowledgeReviews.filter((review) => new Date(review.nextReviewAt).getTime() <= Date.now()).filter((review) => points.some((point) => point.id === review.knowledgePointId)).length
  const riskCount = points.filter((point) => (masteryMap.get(point.id)?.score ?? 0) < 70).length
  const average = points.length ? points.reduce((sum, point) => sum + (masteryMap.get(point.id)?.score ?? 0), 0) / points.length : 0

  function togglePoint(id: string): void {
    setSelected((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id])
  }

  async function addPoint(): Promise<void> {
    const article = activeArticles.find((item) => item.lawId === lawFilter) ?? activeArticles[0]
    if (!article) return
    const name = window.prompt('考點名稱')?.trim()
    if (!name) return
    await data.createKnowledgePoint({ articleId: article.id, name, type: 'CUSTOM', importance: 4, difficulty: 3, keywords: [], originalSentence: article.text, dependencies: [], relatedPoints: [], confusionPoints: [], source: 'manual' })
  }

  async function editPoint(id: string): Promise<void> {
    const point = data.knowledgePoints.find((item) => item.id === id)
    const name = point && window.prompt('修改考點名稱', point.name)?.trim()
    if (point && name) await data.updateKnowledgePoint({ ...point, name })
  }

  async function splitPoint(id: string): Promise<void> {
    const names = window.prompt('輸入拆分後的考點名稱，以逗號分隔')?.split(/[、,，]/u).map((item) => item.trim()).filter(Boolean) ?? []
    if (names.length >= 2) await data.splitKnowledgePoint(id, names)
  }

  return <div className="page-stack knowledge-dashboard-page"><KnowledgeMap points={points.slice(0, 80)} articleMap={articleMap} masteryMap={masteryMap} />
    <PageHeader eyebrow="KNOWLEDGE ENGINE / 考點中心" title="考點儀表板" description="把法條拆成可測量的最小記憶單位，數字、期限、應得不得與法律效果各自追蹤。所有規則題都連回原文，不由系統自行解釋法律。" actions={<Button onClick={() => void addPoint()}>新增自訂考點</Button>} />
    <section className="knowledge-summary-grid"><div className="card"><span className="eyebrow">TOTAL POINTS</span><strong>{points.length}</strong><small>考點</small></div><div className="card"><span className="eyebrow">AVERAGE MASTERY</span><strong>{Math.round(average)}%</strong><ProgressBar value={average} showValue={false} tone={average >= 90 ? 'green' : average >= 70 ? 'gold' : 'red'} /></div><div className="card"><span className="eyebrow">DUE REVIEW</span><strong>{dueCount}</strong><small>待複習</small></div><div className="card"><span className="eyebrow">HIGH RISK</span><strong>{riskCount}</strong><small>低於 70%</small></div></section>
    <section className="knowledge-toolbar card"><label>法規<select value={lawFilter} onChange={(event) => setLawFilter(event.target.value)}><option value="all">全部法規</option>{activeLaws.map((law) => <option key={law.id} value={law.id}>{law.shortName || law.name}</option>)}</select></label><label>考點類型<select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as 'all' | KnowledgePointType)}><option value="all">全部類型</option>{Object.entries(KNOWLEDGE_POINT_TYPE_LABELS).map(([type, label]) => <option key={type} value={type}>{label}</option>)}</select></label><label className="search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋考點、原文或關鍵詞" /></label>{selected.length >= 2 && <Button variant="secondary" onClick={() => void data.mergeKnowledgePoints(selected)}>合併選取 {selected.length} 個</Button>}</section>
    {points.length ? <section className="knowledge-point-grid">{points.map((point) => { const article = articleMap.get(point.articleId); const law = article && activeLaws.find((item) => item.id === article.lawId); const mastery = masteryMap.get(point.id); const selectedPoint = selected.includes(point.id); return <article className={`knowledge-point-card card ${selectedPoint ? 'is-selected' : ''}`} key={point.id}><div className="knowledge-point-card-head"><label className="checkbox-row"><input type="checkbox" checked={selectedPoint} onChange={() => togglePoint(point.id)} /><span className="knowledge-type-badge">{KNOWLEDGE_POINT_TYPE_LABELS[point.type]}</span></label><span className="knowledge-importance">重要度 {point.importance}/5</span></div><p className="eyebrow">{law?.shortName ?? '未知法規'} · 第 {article?.articleNumber ?? '?'} 條</p><h2>{point.name}</h2><p className="knowledge-source-text">{point.originalSentence}</p><div className="knowledge-point-meta"><StatusBadge status={mastery?.status ?? '未開始'} /><span>{Math.round(mastery?.score ?? 0)}%</span><span>{questionCountMap.get(point.id) ?? 0} 題</span></div><ProgressBar value={mastery?.score ?? 0} showValue={false} tone={(mastery?.score ?? 0) >= 90 ? 'green' : (mastery?.score ?? 0) >= 70 ? 'gold' : 'red'} /><div className="row-actions"><Button onClick={() => article && navigate(`/training/${article.id}?point=${point.id}`)}>開始考點訓練</Button><Button variant="ghost" onClick={() => void editPoint(point.id)}>編輯</Button><Button variant="ghost" onClick={() => void splitPoint(point.id)}>拆分</Button><Button variant="ghost" onClick={() => void data.deleteKnowledgePoint(point.id)}>刪除</Button></div></article> })}</section> : <EmptyState icon="◇" title="尚未找到考點" description="匯入法條後，系統會自動建立規則考點；也可以新增自訂考點。" action={<Button onClick={() => void addPoint()}>新增考點</Button>} />}
  </div>
}

function KnowledgeMap({ points, articleMap, masteryMap }: { points: KnowledgePoint[]; articleMap: Map<string, LawArticle>; masteryMap: Map<string, KnowledgeMastery> }): JSX.Element {
  const navigate = useNavigate()
  const groups = new Map<string, typeof points>()
  points.forEach((point) => {
    const article = articleMap.get(point.articleId)
    const key = article ? `${article.lawId} · 第 ${article.articleNumber} 條` : '未分類法條'
    groups.set(key, [...(groups.get(key) ?? []), point])
  })
  return <section className="knowledge-map card"><div className="card-heading"><div><p className="eyebrow">KNOWLEDGE MAP / 考點地圖</p><h2>法條 → 考點 → 熟練度</h2></div><span className="muted">點擊節點開始訓練</span></div><div className="knowledge-map-groups">{Array.from(groups.entries()).map(([label, group]) => <div className="knowledge-map-group" key={label}><strong>{label}</strong><div className="knowledge-map-points">{group.map((point) => <button type="button" key={point.id} onClick={() => navigate(`/training/${point.articleId}?point=${point.id}`)}><span>{point.name}</span><b>{Math.round(masteryMap.get(point.id)?.score ?? 0)}%</b></button>)}</div></div>)}</div></section>
}
