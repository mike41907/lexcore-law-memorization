import type { LawArticle } from '../types'

export type SystemLevel = '編' | '章' | '節' | '款' | '目' | '未分章'

export interface LawSystemNode {
  id: string
  level: SystemLevel
  label: string
  articleIds: string[]
  directArticleIds: string[]
  children: LawSystemNode[]
  startArticle: string
  endArticle: string
}

export interface LawSystemMap {
  roots: LawSystemNode[]
  articleCount: number
  nodeCount: number
}

const LEVEL_RANK: Record<SystemLevel, number> = { 編: 1, 章: 2, 節: 3, 款: 4, 目: 5, 未分章: 0 }

export function compareArticleNumbers(left: LawArticle, right: LawArticle): number {
  const a = numberParts(left.articleNumber)
  const b = numberParts(right.articleNumber)
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (a[index] ?? -1) - (b[index] ?? -1)
    if (difference) return difference
  }
  return left.articleNumber.localeCompare(right.articleNumber, 'zh-TW', { numeric: true })
}

export function buildLawSystemMap(input: LawArticle[]): LawSystemMap {
  const articles = input.filter((article) => !article.deletedAt).sort(compareArticleNumbers)
  const roots: LawSystemNode[] = []
  const stack: LawSystemNode[] = []
  let ungrouped: LawSystemNode | undefined
  let sequence = 0

  for (const article of articles) {
    const parsed = parseHeading(article.title)
    if (parsed) {
      const rank = LEVEL_RANK[parsed.level]
      const current = [...stack].reverse().find((node) => LEVEL_RANK[node.level] === rank)
      if (!current || current.label !== parsed.label) {
        while (stack.length && LEVEL_RANK[stack[stack.length - 1].level] >= rank) stack.pop()
        const node = createNode(`${parsed.level}-${sequence += 1}`, parsed.level, parsed.label, article.articleNumber)
        const parent = stack[stack.length - 1]
        if (parent) parent.children.push(node)
        else roots.push(node)
        stack.push(node)
      }
    }

    let target = stack[stack.length - 1]
    if (!target) {
      if (!ungrouped) {
        ungrouped = createNode('ungrouped', '未分章', '未分章（依條號排列）', article.articleNumber)
        roots.push(ungrouped)
      }
      target = ungrouped
    }
    target.directArticleIds.push(article.id)
    for (const node of stack.length ? stack : [target]) addArticle(node, article)
  }

  return { roots, articleCount: articles.length, nodeCount: countNodes(roots) }
}

export function flattenSystemNodes(nodes: LawSystemNode[]): LawSystemNode[] {
  return nodes.flatMap((node) => [node, ...flattenSystemNodes(node.children)])
}

function parseHeading(raw: string): { level: SystemLevel; label: string } | null {
  const label = raw.replace(/\s+/g, ' ').trim()
  if (!label) return null
  const match = label.match(/^第\s*.+?\s*(編|章|節|款|目)(?:之\s*[^\s]+)?(?:\s+|$)/)
  return match ? { level: match[1] as SystemLevel, label } : null
}

function createNode(id: string, level: SystemLevel, label: string, articleNumber: string): LawSystemNode {
  return { id, level, label, articleIds: [], directArticleIds: [], children: [], startArticle: articleNumber, endArticle: articleNumber }
}

function addArticle(node: LawSystemNode, article: LawArticle): void {
  node.articleIds.push(article.id)
  node.endArticle = article.articleNumber
}

function countNodes(nodes: LawSystemNode[]): number {
  return nodes.reduce((sum, node) => sum + 1 + countNodes(node.children), 0)
}

function numberParts(value: string): number[] {
  const matches = value.normalize('NFKC').match(/\d+/g)
  return matches?.map(Number) ?? [Number.MAX_SAFE_INTEGER]
}
