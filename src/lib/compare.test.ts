import { describe, expect, it } from 'vitest'
import { compareText, normalizeForCompare } from './compare'

const options = { ignorePunctuation: true, ignoreWhitespace: true, ignoreLineBreaks: true, ignoreFullHalf: true, ignoreArabicChineseNumbers: false, strictLegalTerms: true, strictStructure: true }

describe('compareText', () => {
  it('normalizes punctuation and whitespace without changing legal words', () => {
    expect(normalizeForCompare('警察，於 公共場所。', options)).toBe('警察於公共場所')
  })

  it('detects missing, extra and replacement text', () => {
    const result = compareText('警察於公共場所或合法進入之場所。', '警察在公共場所。', options, ['於', '或', '之'])
    expect(result.missing.join('')).toContain('合法進入之')
    expect(result.missing.join('')).toContain('或')
    expect(result.replacements).toContainEqual({ expected: '於', actual: '在' })
    expect(result.errors.some((item) => item.kind === 'keyword')).toBe(true)
    expect(result.score).toBeLessThan(95)
  })

  it('gives a perfect score for an exact answer', () => {
    const result = compareText('甲乙丙。', '甲乙丙。', options, ['得'])
    expect(result.accuracy).toBe(100)
    expect(result.score).toBe(100)
    expect(result.grade).toBe('S')
    expect(result.errors).toHaveLength(0)
  })

  it('does not treat a hint-assisted answer as S', () => {
    const result = compareText('甲乙丙。', '甲乙丙。', options, [], 2)
    expect(result.score).toBeLessThan(100)
    expect(result.grade).toBe('A')
  })
})
