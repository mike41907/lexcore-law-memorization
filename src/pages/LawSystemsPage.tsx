import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button, EmptyState, PageHeader, ProgressBar } from '../components/ui'
import { useAppData } from '../context/AppContext'
import { buildLawSystemMap, flattenSystemNodes, type LawSystemNode } from '../lib/lawSystem'
import type { LawArticle } from '../types'

export function LawSystemsPage(): JSX.Element {
  const data = useAppData()
  const { lawId } = useParams()
  const laws = data.laws.filter((law) => !law.deletedAt)
  const selectedLaw = laws.find((law) => law.id === lawId) ?? laws[0]
  const articles = useMemo(() => data.articles.filter((article) => article.lawId === selectedLaw?.id && !article.deletedAt), [data.articles, selectedLaw?.id])
  const map = useMemo(() => buildLawSystemMap(articles), [articles])
  const articleById = useMemo(() => new Map(articles.map((article) => [article.id, article])), [articles])
  const allNodeIds = useMemo(() => flattenSystemNodes(map.roots).map((node) => node.id), [map.roots])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [showArticles, setShowArticles] = useState(false)
  const average = articles.length ? articles.reduce((sum, article) => sum + (data.mastery.find((item) => item.articleId === article.id)?.score ?? 0), 0) / articles.length : 0

  if (!laws.length) return <EmptyState icon="⌘" title="尚未建立法規" description="先匯入法規與條文，系統就會自動產生體系圖。" />

  return <div className="page-stack">
    <PageHeader eyebrow="SYSTEM MAP / 法規骨架" title="法規體系圖" description="先熟悉編、章、節與條文位置，再進入逐條背誦；體系圖會直接使用已匯入的官方章節資料。" actions={<Link className="button button-primary" to={`/training/${articles[0]?.id ?? ''}`}>從第一條開始訓練</Link>} />
    <section className="system-map-toolbar card">
      <label>選擇法規<select value={selectedLaw?.id} onChange={(event) => { window.location.hash = `#/systems/${event.target.value}`; setExpanded(new Set()) }}>{laws.map((law) => <option value={law.id} key={law.id}>{law.category}｜{law.name}</option>)}</select></label>
      <div className="system-map-stats"><div><strong>{map.articleCount}</strong><span>條文</span></div><div><strong>{map.nodeCount}</strong><span>體系節點</span></div><div><strong>{Math.round(average)}%</strong><span>熟練度</span></div></div>
      <div className="system-map-actions"><Button variant={showArticles ? 'secondary' : 'gold'} onClick={() => setShowArticles(false)}>只看骨架</Button><Button variant={showArticles ? 'gold' : 'secondary'} onClick={() => setShowArticles(true)}>顯示條文</Button><Button variant="ghost" onClick={() => setExpanded(new Set(allNodeIds))}>展開全部</Button><Button variant="ghost" onClick={() => setExpanded(new Set())}>收合全部</Button></div>
    </section>
    <section className="system-map-intro card"><div><span className="system-map-mark">⌘</span><div><p className="eyebrow">CURRENT LAW / 目前法規</p><h2>{selectedLaw?.name}</h2><p>{map.roots.length} 個主體系 · 第 {articles.length ? map.roots[0]?.startArticle : '—'} 條起</p></div></div><ProgressBar value={average} label="全法熟練度" tone={average >= 80 ? 'green' : 'blue'} /></section>
    {articles.length ? <div className="system-tree" role="tree" aria-label={`${selectedLaw?.name}體系圖`}>{map.roots.map((node, index) => <SystemNodeView key={node.id} node={node} index={index + 1} expanded={expanded} setExpanded={setExpanded} showArticles={showArticles} articleById={articleById} mastery={data.mastery} />)}</div> : <EmptyState icon="§" title="這部法規還沒有條文" description="匯入條文後，體系圖會自動出現。" />}
  </div>
}

function SystemNodeView({ node, index, expanded, setExpanded, showArticles, articleById, mastery }: { node: LawSystemNode; index: number; expanded: Set<string>; setExpanded: (value: Set<string>) => void; showArticles: boolean; articleById: Map<string, LawArticle>; mastery: Array<{ articleId: string; score: number }> }): JSX.Element {
  const open = expanded.has(node.id)
  const score = node.articleIds.length ? node.articleIds.reduce((sum, id) => sum + (mastery.find((item) => item.articleId === id)?.score ?? 0), 0) / node.articleIds.length : 0
  const toggle = () => { const next = new Set(expanded); if (open) next.delete(node.id); else next.add(node.id); setExpanded(next) }
  return <article className={`system-node system-level-${node.level}`} role="treeitem" aria-expanded={open}>
    <button className="system-node-head" onClick={toggle}><span className="system-node-index">{String(index).padStart(2, '0')}</span><span className="system-node-copy"><small>{node.level}</small><strong>{node.label}</strong><em>第 {node.startArticle} 條－第 {node.endArticle} 條 · {node.articleIds.length} 條</em></span><span className="system-node-score">{Math.round(score)}%</span><span className="system-node-toggle">{open ? '−' : '＋'}</span></button>
    {open && <div className="system-node-body">
      {node.children.length > 0 && <div className="system-children" role="group">{node.children.map((child, childIndex) => <SystemNodeView key={child.id} node={child} index={childIndex + 1} expanded={expanded} setExpanded={setExpanded} showArticles={showArticles} articleById={articleById} mastery={mastery} />)}</div>}
      {showArticles && node.directArticleIds.length > 0 && <div className="system-articles">{node.directArticleIds.map((id) => { const article = articleById.get(id); if (!article) return null; const articleScore = mastery.find((item) => item.articleId === id)?.score ?? 0; return <div className="system-article" key={id}><div><strong>第 {article.articleNumber} 條</strong><span>{article.text.slice(0, 72)}{article.text.length > 72 ? '…' : ''}</span></div><em>{Math.round(articleScore)}%</em><Link className="button button-ghost" to={`/training/${article.id}`}>背這條</Link></div> })}</div>}
    </div>}
  </article>
}
