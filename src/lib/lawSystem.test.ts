import { describe, expect, it } from 'vitest'
import type { LawArticle } from '../types'
import { buildLawSystemMap, compareArticleNumbers } from './lawSystem'

const article = (number: string, title = '') => ({ id: `a-${number}`, lawId: 'law', articleNumber: number, title, text: '', notes: '', importance: 3, mustMemorize: true, includeDaily: true, tags: [], isBoss: false, createdAt: '', updatedAt: '' }) as LawArticle

describe('law system map', () => {
  it('sorts compound article numbers naturally', () => {
    expect([article('10'), article('2-1'), article('2'), article('1')].sort(compareArticleNumbers).map((item) => item.articleNumber)).toEqual(['1', '2', '2-1', '10'])
  })

  it('sorts Chinese article numbers naturally', () => {
    expect([article('十'), article('二'), article('二之一'), article('一')].sort(compareArticleNumbers).map((item) => item.articleNumber)).toEqual(['一', '二', '二之一', '十'])
  })

  it('collapses repeated headings without inventing missing parents', () => {
    const map = buildLawSystemMap([article('1', '第 一 章 總則'), article('2', '第 一 章 總則'), article('3', '第 一 節 通則'), article('4', '第 一 節 通則'), article('5', '第 二 章 執行')])
    expect(map.roots).toHaveLength(3)
    expect(map.roots[0].articleIds).toHaveLength(2)
    expect(map.roots[1].directArticleIds).toEqual(['a-3', 'a-4'])
    expect(map.roots[0].startArticle).toBe('1')
    expect(map.roots[0].endArticle).toBe('2')
  })

  it('keeps laws without official divisions usable', () => {
    const map = buildLawSystemMap([article('2'), article('1')])
    expect(map.roots[0].level).toBe('未分章')
    expect(map.roots[0].directArticleIds).toEqual(['a-1', 'a-2'])
  })
})
