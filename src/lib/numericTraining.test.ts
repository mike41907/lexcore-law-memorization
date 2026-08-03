import { describe, expect, it } from 'vitest'
import { createNumericOptions, extractNumericFacts, parseLegalNumber } from './numericTraining'

describe('numeric legal training', () => {
  it('extracts minimum penalties and includes the common three-year/five-year trap', () => {
    const facts = extractNumericFacts('最輕本刑為三年以上有期徒刑；所犯為死刑、無期徒刑或最輕本刑為五年以上有期徒刑之罪。')
    expect(facts.map((fact) => fact.answer)).toEqual(['三年', '五年'])
    expect(facts.every((fact) => fact.category === '刑度門檻')).toBe(true)
    expect(facts[0].options).toContain('三年')
    expect(facts[0].options).toContain('五年')
    expect(facts[1].options).toContain('五年')
    expect(facts[1].options).toContain('三年')
  })

  it('extracts each detention deadline as a separate exact-memory fact', () => {
    const facts = extractNumericFacts('羈押被告，偵查中不得逾二月，審判中不得逾三月。延長羈押之聲請，至遲於期間屆滿之五日前提出。')
    expect(facts.map((fact) => fact.answer)).toEqual(['二月', '三月', '五日'])
    expect(facts.every((fact) => fact.category === '程序期間')).toBe(true)
    expect(facts[0].before).toContain('偵查中不得逾')
    expect(facts[0].after).toContain('審判中')
  })

  it('supports retention periods, money, ages, ratios and Arabic digits', () => {
    const facts = extractNumericFacts('鑑定留置延長不得逾二月；年滿十八歲者，處新臺幣三萬元；同意人數須達三分之二，並於24小時內通知。')
    expect(facts.map((fact) => fact.answer)).toEqual(['二月', '十八歲', '三萬元', '三分之二', '24小時'])
    expect(facts.map((fact) => fact.category)).toEqual(['程序期間', '年齡門檻', '金額／罰鍰', '比例門檻', '程序期間'])
  })

  it('does not turn cited article, paragraph or subparagraph numbers into drill questions', () => {
    expect(extractNumericFacts('依第一百零八條第二項及第三項規定辦理。')).toEqual([])
  })

  it('creates four unique same-unit options with the correct answer exactly once', () => {
    const fact = extractNumericFacts('期間不得逾二十四小時。')[0]
    const options = createNumericOptions(fact)
    expect(options).toHaveLength(4)
    expect(new Set(options).size).toBe(4)
    expect(options.filter((option) => option === '二十四小時')).toHaveLength(1)
    expect(options.every((option) => option.endsWith('小時'))).toBe(true)
  })

  it('parses common legal Chinese numerals', () => {
    expect(parseLegalNumber('三')).toBe(3)
    expect(parseLegalNumber('二十四')).toBe(24)
    expect(parseLegalNumber('一百二十')).toBe(120)
    expect(parseLegalNumber('三萬')).toBe(30_000)
    expect(parseLegalNumber('一億五千萬')).toBe(150_000_000)
    expect(parseLegalNumber('半')).toBe(0.5)
  })
})
