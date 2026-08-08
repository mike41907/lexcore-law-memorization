import { describe, expect, it } from 'vitest'
import { splitArticleTextBlocks } from './articleStructure'

describe('splitArticleTextBlocks', () => {
  it('labels paragraphs while preserving款 and目 markers', () => {
    const result = splitArticleTextBlocks('第一段內容。\n一、第一款。\n（一）第一目。\n第二段內容。')
    expect(result.map((item) => [item.kind, item.paragraphNumber, item.text])).toEqual([
      ['paragraph', 1, '第一段內容。'],
      ['item', 1, '一、第一款。'],
      ['subitem', 1, '（一）第一目。'],
      ['paragraph', 2, '第二段內容。'],
    ])
  })

  it('keeps a single-line article as the first paragraph', () => {
    expect(splitArticleTextBlocks('只有一段。')).toEqual([{ kind: 'paragraph', paragraphNumber: 1, text: '只有一段。' }])
  })
})
