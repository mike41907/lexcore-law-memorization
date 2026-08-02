import { describe, expect, it } from 'vitest'
import { splitLawText } from './importer'

describe('splitLawText', () => {
  it('splits common article heading formats', () => {
    const result = splitLawText('第1條\n甲內容。\n\n第 2 條\n乙內容。\n\n第　三　條\n丙內容。')
    expect(result).toHaveLength(3)
    expect(result.map((item) => item.articleNumber)).toEqual(['1', '2', '三'])
    expect(result[1].text).toBe('乙內容。')
  })

  it('returns a reviewable unnumbered draft when no heading exists', () => {
    const result = splitLawText('尚未標示條號的內容')
    expect(result).toHaveLength(1)
    expect(result[0].articleNumber).toBe('未編號')
    expect(result[0].notes).toContain('未偵測')
  })
})
