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
  let ungrouped: LawSystemNode | undefined
  let current: LawSystemNode | undefined
  let sequence = 0

  for (const article of articles) {
    const parsed = parseHeading(article.title)
    if (parsed && (!current || current.label !== parsed.label)) {
      current = createNode(`${parsed.level}-${sequence += 1}`, parsed.level, parsed.label, article.articleNumber)
      roots.push(current)
    }

    let target = current
    if (!target) {
      if (!ungrouped) {
        ungrouped = createNode('ungrouped', '未分章', '未分章（依條號排列）', article.articleNumber)
        roots.push(ungrouped)
      }
      target = ungrouped
    }
    target.directArticleIds.push(article.id)
    addArticle(target, article)
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
  const matches = value.normalize('NFKC').replace(/[第條]/g, '').match(/\d+|[〇零一二三四五六七八九十百千]+/g)
  return matches?.map((part) => /^\d+$/.test(part) ? Number(part) : chineseNumberToArabic(part)) ?? [Number.MAX_SAFE_INTEGER]
}

function chineseNumberToArabic(value: string): number {
  const digits: Record<string, number> = { 〇: 0, 零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 }
  const units: Record<string, number> = { 十: 10, 百: 100, 千: 1000 }
  let total = 0
  let current = 0
  for (const character of value) {
    if (character in units) {
      total += (current || 1) * units[character]
      current = 0
    } else {
      current = digits[character] ?? current
    }
  }
  return total + current
}
