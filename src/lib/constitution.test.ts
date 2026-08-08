import { describe, expect, it } from 'vitest'
import { extractStoppedConstitutionArticleNumbers } from './constitution'

describe('constitutional amendment retirement filter', () => {
  it('extracts suspended article ranges and separate references', () => {
    const stopped = extractStoppedConstitutionArticleNumbers([
      '憲法第二十五條至第三十四條及第一百三十五條之規定，停止適用。',
      '憲法第九十一條至第九十三條之規定停止適用。',
      '憲法第七十四條之規定，停止適用。',
    ])
    expect(stopped.has('25')).toBe(true)
    expect(stopped.has('34')).toBe(true)
    expect(stopped.has('135')).toBe(true)
    expect(stopped.has('91')).toBe(true)
    expect(stopped.has('93')).toBe(true)
    expect(stopped.has('74')).toBe(true)
    expect(stopped.has('35')).toBe(false)
  })

  it('does not treat a contextual non-application clause as repeal', () => {
    expect(extractStoppedConstitutionArticleNumbers(['不適用憲法第四十七條之規定。'])).toEqual(new Set())
  })

  it('keeps an article when only one of its provisions is suspended', () => {
    expect(extractStoppedConstitutionArticleNumbers(['憲法第八十五條有關按省區分別規定名額，分區舉行考試之規定，停止適用。'])).toEqual(new Set())
  })
})
