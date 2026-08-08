import { useEffect, useMemo, useRef, useState, type PointerEvent } from 'react'
import { Button } from './ui'
import type { LawSystemMap, LawSystemNode } from '../lib/lawSystem'
import type { MasteryRecord } from '../types'

interface Props {
  lawName: string
  map: LawSystemMap
  mastery: MasteryRecord[]
  activeNodeId?: string
  onSelectArticle: (articleId: string) => void
}

export function LawStructureMap({ lawName, map, mastery, activeNodeId, onSelectArticle }: Props): JSX.Element {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(map.roots.map((node) => node.id)))
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number; offsetX: number; offsetY: number } | null>(null)
  const masteryMap = useMemo(() => new Map(mastery.map((item) => [item.articleId, item.score])), [mastery])

  useEffect(() => {
    setExpanded(new Set(map.roots.map((node) => node.id)))
    setScale(1)
    setOffset({ x: 0, y: 0 })
  }, [map])

  const allNodes = useMemo(() => flatten(map.roots), [map.roots])

  function toggle(nodeId: string): void {
    setExpanded((current) => {
      const next = new Set(current)
      if (next.has(nodeId)) next.delete(nodeId)
      else next.add(nodeId)
      return next
    })
  }

  function fitView(): void {
    setScale(1)
    setOffset({ x: 0, y: 0 })
  }

  function startDrag(event: PointerEvent<HTMLDivElement>): void {
    if ((event.target as HTMLElement).closest('button')) return
    drag.current = { x: event.clientX, y: event.clientY, offsetX: offset.x, offsetY: offset.y }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function moveDrag(event: PointerEvent<HTMLDivElement>): void {
    if (!drag.current) return
    setOffset({ x: drag.current.offsetX + event.clientX - drag.current.x, y: drag.current.offsetY + event.clientY - drag.current.y })
  }

  function stopDrag(): void {
    drag.current = null
  }

  return <section className="law-structure card">
    <div className="law-structure-heading">
      <div><p className="eyebrow">STRUCTURE / 法規體系</p><h2>{lawName}架構圖</h2><p className="muted-text">架構只取自已匯入法條的官方標題；點選節點可跳到對應全文。</p></div>
      <div className="law-structure-actions">
        <div className="law-structure-zoom-controls" aria-label="架構圖縮放">
          <Button variant="ghost" onClick={() => setScale((value) => Math.max(.7, value - .1))} aria-label="縮小架構圖">−</Button>
          <span className="structure-zoom">{Math.round(scale * 100)}%</span>
          <Button variant="ghost" onClick={() => setScale((value) => Math.min(1.8, value + .1))} aria-label="放大架構圖">＋</Button>
        </div>
        <div className="law-structure-view-controls">
          <Button variant="secondary" onClick={fitView}>適合檢視</Button>
          <Button variant="ghost" onClick={() => setExpanded(new Set(allNodes.map((node) => node.id)))}>全部展開</Button>
          <Button variant="ghost" onClick={() => setExpanded(new Set())}>全部收合</Button>
        </div>
      </div>
    </div>
    <div className="law-structure-layout">
      <aside className="law-structure-outline" aria-label="法律樹快速導覽"><div className="law-structure-outline-title">法律樹</div>{map.roots.map((node) => <OutlineNode key={node.id} node={node} onSelectArticle={onSelectArticle} />)}</aside>
      <div className="law-structure-viewport" onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={stopDrag} onPointerCancel={stopDrag} onWheel={(event) => { event.preventDefault(); setScale((value) => Math.max(.7, Math.min(1.8, value + (event.deltaY < 0 ? .05 : -.05)))) }}>
        <div className="law-structure-canvas" style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}>
          <div className="law-structure-tree" role="tree" aria-label={`${lawName}法規體系`}>
            {map.roots.map((node) => <StructureNode key={node.id} node={node} expanded={expanded} activeNodeId={activeNodeId} masteryMap={masteryMap} onToggle={toggle} onSelectArticle={onSelectArticle} />)}
          </div>
        </div>
      </div>
    </div>
    <p className="law-structure-hint"><span className="law-structure-desktop-hint">拖曳空白處平移 · 滾輪縮放 · </span><span className="law-structure-mobile-hint">手機版採直向閱讀；點選章節即可定位全文 · </span>目前 {map.articleCount} 條法條、{map.nodeCount} 個架構節點</p>
  </section>
}

function OutlineNode({ node, onSelectArticle }: { node: LawSystemNode; onSelectArticle: (articleId: string) => void }): JSX.Element {
  return <div className="law-outline-node"><button type="button" onClick={() => onSelectArticle(node.anchorArticleId)}><span>{node.level}</span>{node.label.replace(/^第\s*/, '')}</button>{node.children.length > 0 && <div>{node.children.map((child) => <OutlineNode key={child.id} node={child} onSelectArticle={onSelectArticle} />)}</div>}</div>
}

function StructureNode({ node, expanded, activeNodeId, masteryMap, onToggle, onSelectArticle }: { node: LawSystemNode; expanded: Set<string>; activeNodeId?: string; masteryMap: Map<string, number>; onToggle: (id: string) => void; onSelectArticle: (id: string) => void }): JSX.Element {
  const open = expanded.has(node.id)
  const score = node.articleIds.length ? node.articleIds.reduce((sum, id) => sum + (masteryMap.get(id) ?? 0), 0) / node.articleIds.length : 0
  return <div className={`law-structure-node ${activeNodeId === node.id ? 'is-active' : ''}`} data-structure-node={node.id} role="treeitem" aria-expanded={node.children.length ? open : undefined}>
    <div className="law-structure-node-card" title={`${node.articleIds.length} 條 · 熟練度 ${Math.round(score)}%`}>
      <button type="button" className="law-structure-node-link" onClick={() => onSelectArticle(node.anchorArticleId)}><small>{node.level}</small><strong>{node.label}</strong><span>第 {node.startArticle}～{node.endArticle} 條 · {node.articleIds.length} 條</span></button>
      <span className="law-structure-node-score">{Math.round(score)}%</span>
      {node.children.length > 0 && <button type="button" className="law-structure-node-toggle" onClick={() => onToggle(node.id)} aria-label={open ? '收合節點' : '展開節點'}>{open ? '−' : '+'}</button>}
    </div>
    {open && node.children.length > 0 && <div className="law-structure-children" role="group">{node.children.map((child) => <StructureNode key={child.id} node={child} expanded={expanded} activeNodeId={activeNodeId} masteryMap={masteryMap} onToggle={onToggle} onSelectArticle={onSelectArticle} />)}</div>}
  </div>
}

function flatten(nodes: LawSystemNode[]): LawSystemNode[] {
  return nodes.flatMap((node) => [node, ...flatten(node.children)])
}
