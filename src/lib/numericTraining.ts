export type NumericFactCategory = '刑度門檻' | '程序期間' | '年齡門檻' | '金額／罰鍰' | '比例門檻' | '人數／次數' | '距離／重量' | '其他數字'

export interface NumericFact {
  id: string
  answer: string
  numeral: string
  unit: string
  unitKey: string
  value?: number
  category: NumericFactCategory
  start: number
  end: number
  before: string
  after: string
  context: string
  options: string[]
}

interface NumericFactDraft extends Omit<NumericFact, 'options'> {}

const NUMBER_PATTERN = String.raw`(?:[0-9０-９]+(?:[,.，．][0-9０-９]+)?|[零〇○一二兩三四五六七八九十百千萬億兆廿卅半]+)`
const UNIT_PATTERN = String.raw`(?:個\s*)?(?:小時|鐘頭|分鐘|秒鐘|星期|年|月|週|日|天|歲|元|圓|倍|成|人|次|件|名|份|戶|席|票|公尺|公里|公分|公克|公斤)`
const FRACTION_PATTERN = new RegExp(String.raw`(?:[百千萬]分之${NUMBER_PATTERN}|${NUMBER_PATTERN}\s*分之\s*${NUMBER_PATTERN})`, 'gu')
const QUANTITY_PATTERN = new RegExp(String.raw`(${NUMBER_PATTERN})\s*(${UNIT_PATTERN})`, 'gu')

const BENCHMARKS: Record<string, number[]> = {
  year: [0.5, 1, 2, 3, 5, 7, 10, 12, 15, 20, 25, 30],
  month: [0.5, 1, 2, 3, 4, 6, 8, 12, 18, 24],
  week: [1, 2, 3, 4, 6, 8, 12],
  day: [0.5, 1, 2, 3, 5, 7, 10, 14, 15, 20, 30, 45, 60, 90, 120],
  hour: [1, 2, 4, 6, 8, 12, 24, 36, 48, 72],
  minute: [5, 10, 15, 20, 30, 45, 60, 90],
  second: [5, 10, 15, 20, 30, 60],
  age: [7, 12, 14, 16, 18, 20, 65, 70],
  count: [1, 2, 3, 4, 5, 6, 8, 10, 12, 15, 20, 30],
  multiplier: [0.5, 1, 2, 3, 4, 5, 10],
  distance: [1, 2, 3, 5, 10, 20, 30, 50, 100, 200, 500, 1000],
}

const FRACTION_OPTIONS = ['二分之一', '三分之一', '三分之二', '四分之一', '四分之三', '五分之一']
const PERCENT_OPTIONS = ['百分之五', '百分之十', '百分之二十', '百分之二十五', '百分之三十', '百分之五十', '百分之七十五']

export function extractNumericFacts(text: string): NumericFact[] {
  if (!text.trim()) return []
  const drafts: NumericFactDraft[] = []
  const occupied: Array<{ start: number; end: number }> = []

  for (const match of text.matchAll(FRACTION_PATTERN)) {
    const answer = match[0].replace(/\s+/g, '')
    const start = match.index ?? 0
    const end = start + match[0].length
    const contextRange = createContextRange(text, start, end)
    drafts.push({
      id: numericFactId(start, answer),
      answer,
      numeral: answer,
      unit: '比例',
      unitKey: 'ratio',
      value: parseRatio(answer),
      category: '比例門檻',
      start,
      end,
      before: contextRange.before,
      after: contextRange.after,
      context: contextRange.context,
    })
    occupied.push({ start, end })
  }

  for (const match of text.matchAll(QUANTITY_PATTERN)) {
    const start = match.index ?? 0
    const end = start + match[0].length
    if (occupied.some((range) => start < range.end && end > range.start)) continue
    const numeral = match[1].replace(/\s+/g, '')
    const unit = match[2].replace(/\s+/g, '')
    const answer = `${numeral}${unit}`
    const contextRange = createContextRange(text, start, end)
    const nearby = text.slice(Math.max(0, start - 80), Math.min(text.length, end + 80))
    drafts.push({
      id: numericFactId(start, answer),
      answer,
      numeral,
      unit,
      unitKey: normalizeUnit(unit),
      value: parseLegalNumber(numeral),
      category: categorizeFact(unit, nearby),
      start,
      end,
      before: contextRange.before,
      after: contextRange.after,
      context: contextRange.context,
    })
  }

  drafts.sort((left, right) => left.start - right.start)
  return drafts.map((draft) => ({ ...draft, options: createNumericOptions(draft, drafts) }))
}

export function createNumericOptions(fact: NumericFactDraft, peers: NumericFactDraft[] = []): string[] {
  if (fact.unitKey === 'ratio') {
    const pool = fact.answer.startsWith('百分之') ? PERCENT_OPTIONS : FRACTION_OPTIONS
    return stableShuffle(unique([fact.answer, ...nearestRatioOptions(fact, pool)]).slice(0, 4), fact.id)
  }

  const value = fact.value
  const peerValues = peers
    .filter((peer) => peer.id !== fact.id && peer.unitKey === fact.unitKey && peer.value !== undefined)
    .sort((left, right) => Math.abs(left.start - fact.start) - Math.abs(right.start - fact.start))
    .map((peer) => peer.value as number)
  const pool = benchmarkPool(fact.unitKey, value)
  const rankedPool = uniqueNumbers(pool)
    .filter((candidate) => value === undefined || candidate !== value)
    .sort((left, right) => numericDistance(left, value) - numericDistance(right, value))
  const candidates = uniqueNumbers([...peerValues, ...commonConfusions(fact.unitKey, value), ...rankedPool])
    .filter((candidate) => value === undefined || candidate !== value)

  const formatted = candidates.map((candidate) => formatLikeSource(candidate, fact.numeral, fact.unit))
  const options = unique([fact.answer, ...formatted]).slice(0, 4)
  for (let offset = 1; options.length < 4 && offset <= 10; offset += 1) {
    const fallback = formatLikeSource(Math.max(0.5, (value ?? 1) + offset), fact.numeral, fact.unit)
    if (!options.includes(fallback)) options.push(fallback)
  }
  return stableShuffle(options, fact.id)
}

export function parseLegalNumber(raw: string): number | undefined {
  const normalized = raw.normalize('NFKC').replace(/[，,]/g, '').trim()
  if (!normalized) return undefined
  if (normalized === '半') return 0.5
  if (/^\d+(?:\.\d+)?$/.test(normalized)) return Number(normalized)
  const special = normalized.replace(/廿/g, '二十').replace(/卅/g, '三十').replace(/兩/g, '二')
  if (!/^[零〇○一二三四五六七八九十百千萬億兆]+$/.test(special)) return undefined
  const digits: Record<string, number> = { 零: 0, 〇: 0, '○': 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 }
  const smallUnits: Record<string, number> = { 十: 10, 百: 100, 千: 1000 }
  return parseChineseInteger(special, digits, smallUnits)
}

function parseChineseInteger(input: string, digits: Record<string, number>, smallUnits: Record<string, number>): number {
  let remainder = input
  let total = 0
  for (const [character, multiplier] of [['兆', 1_000_000_000_000], ['億', 100_000_000], ['萬', 10_000]] as const) {
    const index = remainder.indexOf(character)
    if (index < 0) continue
    const high = remainder.slice(0, index)
    total += parseChineseInteger(high || '一', digits, smallUnits) * multiplier
    remainder = remainder.slice(index + 1)
  }
  let section = 0
  let digit = 0
  for (const character of remainder) {
    if (character in digits) {
      digit = digits[character]
    } else if (character in smallUnits) {
      section += (digit || 1) * smallUnits[character]
      digit = 0
    }
  }
  return total + section + digit
}

function benchmarkPool(unitKey: string, value?: number): number[] {
  if (unitKey === 'amount') {
    const amount = value ?? 1000
    const magnitude = 10 ** Math.max(0, Math.floor(Math.log10(Math.max(amount, 1))) - 1)
    return uniqueNumbers([
      amount / 2,
      amount * 2,
      amount - magnitude,
      amount + magnitude,
      500,
      1000,
      2000,
      3000,
      5000,
      10_000,
      20_000,
      30_000,
      50_000,
      100_000,
      300_000,
      500_000,
      1_000_000,
    ]).filter((candidate) => candidate > 0 && Number.isInteger(candidate))
  }
  const base = BENCHMARKS[unitKey] ?? BENCHMARKS.count
  if (value === undefined) return base
  return uniqueNumbers([value - 1, value + 1, value / 2, value * 2, ...base]).filter((candidate) => candidate > 0 && (candidate === 0.5 || Number.isInteger(candidate)))
}

function commonConfusions(unitKey: string, value?: number): number[] {
  if (value === undefined) return []
  const key = `${unitKey}:${value}`
  const pairs: Record<string, number[]> = {
    'year:1': [2, 3, 5],
    'year:2': [1, 3, 5],
    'year:3': [5, 2, 7],
    'year:5': [3, 7, 10],
    'year:7': [5, 10, 3],
    'year:10': [7, 5, 15],
    'month:1': [2, 3, 4],
    'month:2': [3, 1, 4],
    'month:3': [2, 4, 6],
    'month:4': [2, 3, 6],
    'month:6': [3, 4, 8],
    'day:5': [10, 7, 3],
    'day:7': [5, 10, 14],
    'day:10': [5, 7, 14],
    'day:14': [10, 15, 7],
    'day:15': [10, 20, 30],
    'day:30': [20, 15, 60],
    'hour:12': [24, 8, 6],
    'hour:24': [48, 12, 72],
    'hour:48': [24, 72, 36],
    'age:14': [16, 18, 12],
    'age:16': [14, 18, 20],
    'age:18': [16, 20, 14],
  }
  return pairs[key] ?? []
}

function normalizeUnit(unit: string): string {
  if (/小時|鐘頭/.test(unit)) return 'hour'
  if (/分鐘/.test(unit)) return 'minute'
  if (/秒/.test(unit)) return 'second'
  if (/年/.test(unit)) return 'year'
  if (/月/.test(unit)) return 'month'
  if (/週|星期/.test(unit)) return 'week'
  if (/日|天/.test(unit)) return 'day'
  if (/歲/.test(unit)) return 'age'
  if (/元|圓/.test(unit)) return 'amount'
  if (/倍|成/.test(unit)) return 'multiplier'
  if (/公尺|公里|公分|公克|公斤/.test(unit)) return 'distance'
  return 'count'
}

function categorizeFact(unit: string, nearby: string): NumericFactCategory {
  if (/歲/.test(unit)) return '年齡門檻'
  if (/元|圓/.test(unit)) return '金額／罰鍰'
  if (/人|次|件|名|份|戶|席|票/.test(unit)) return '人數／次數'
  if (/公尺|公里|公分|公克|公斤/.test(unit)) return '距離／重量'
  if (/本刑|徒刑|拘役|刑期|宣告刑|執行刑|有期徒刑|無期徒刑|易科罰金/.test(nearby)) return '刑度門檻'
  if (/羈押|拘提|逮捕|留置|期間|期限|屆滿|送達|延長|聲請|不得逾|至遲|以內|以上|以下|未滿|超過|逾/.test(nearby)) return '程序期間'
  return '其他數字'
}

function createContextRange(text: string, start: number, end: number): { before: string; after: string; context: string } {
  const hardStart = Math.max(0, start - 150)
  const hardEnd = Math.min(text.length, end + 150)
  const leftSlice = text.slice(hardStart, start)
  const rightSlice = text.slice(end, hardEnd)
  const leftBoundary = Math.max(leftSlice.lastIndexOf('\n'), leftSlice.lastIndexOf('。'), leftSlice.lastIndexOf('；'))
  const rightCandidates = [rightSlice.indexOf('\n'), rightSlice.indexOf('。'), rightSlice.indexOf('；')].filter((value) => value >= 0)
  const contextStart = leftBoundary >= 0 ? hardStart + leftBoundary + 1 : hardStart
  const contextEnd = rightCandidates.length ? end + Math.min(...rightCandidates) + 1 : hardEnd
  const prefix = contextStart > 0 ? '…' : ''
  const suffix = contextEnd < text.length ? '…' : ''
  const before = `${prefix}${text.slice(contextStart, start)}`
  const after = `${text.slice(end, contextEnd)}${suffix}`
  return { before, after, context: `${before}${text.slice(start, end)}${after}` }
}

function parseRatio(answer: string): number | undefined {
  const compact = answer.replace(/\s+/g, '')
  if (compact.startsWith('百分之')) {
    const numerator = parseLegalNumber(compact.slice(3))
    return numerator === undefined ? undefined : numerator / 100
  }
  const [denominatorRaw, numeratorRaw] = compact.split('分之')
  const denominator = parseLegalNumber(denominatorRaw)
  const numerator = parseLegalNumber(numeratorRaw)
  if (!denominator || numerator === undefined) return undefined
  return numerator / denominator
}

function nearestRatioOptions(fact: NumericFactDraft, pool: string[]): string[] {
  const factValue = fact.value
  return pool
    .filter((option) => option !== fact.answer)
    .sort((left, right) => numericDistance(parseRatio(left) ?? 0, factValue) - numericDistance(parseRatio(right) ?? 0, factValue))
}

function formatLikeSource(value: number, numeral: string, unit: string): string {
  let formatted: string
  if (/^[0-9０-９,.，．]+$/.test(numeral.normalize('NFKC'))) {
    formatted = value === 0.5 ? '0.5' : String(value)
    if (/[０-９]/.test(numeral)) formatted = formatted.replace(/[0-9]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) + 0xfee0))
  } else {
    formatted = value === 0.5 ? '半' : toChineseInteger(value)
  }
  return `${formatted}${unit}`
}

function toChineseInteger(value: number): string {
  const integer = Math.max(1, Math.round(value))
  if (integer >= 100_000_000) {
    const high = Math.floor(integer / 100_000_000)
    const rest = integer % 100_000_000
    return `${toChineseInteger(high)}億${rest ? toChineseUnderTenThousand(Math.floor(rest / 10_000)) + (rest >= 10_000 ? '萬' : '') + toChineseUnderTenThousand(rest % 10_000) : ''}`
  }
  if (integer >= 10_000) {
    const high = Math.floor(integer / 10_000)
    const rest = integer % 10_000
    return `${toChineseUnderTenThousand(high)}萬${rest ? (rest < 1000 ? '零' : '') + toChineseUnderTenThousand(rest) : ''}`
  }
  return toChineseUnderTenThousand(integer)
}

function toChineseUnderTenThousand(value: number): string {
  if (!value) return ''
  const digits = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九']
  const units = ['', '十', '百', '千']
  let output = ''
  let zeroPending = false
  for (let position = 3; position >= 0; position -= 1) {
    const divisor = 10 ** position
    const digit = Math.floor(value / divisor) % 10
    if (digit) {
      if (zeroPending && output) output += '零'
      if (!(digit === 1 && position === 1 && !output)) output += digits[digit]
      output += units[position]
      zeroPending = false
    } else if (output && value % divisor) {
      zeroPending = true
    }
  }
  return output || '零'
}

function numericDistance(candidate: number, expected?: number): number {
  if (expected === undefined) return candidate
  return Math.abs(Math.log((candidate + 1) / (expected + 1)))
}

function stableShuffle<T>(items: T[], seedText: string): T[] {
  const next = [...items]
  let seed = 2166136261
  for (const character of seedText) {
    seed ^= character.charCodeAt(0)
    seed = Math.imul(seed, 16777619)
  }
  for (let index = next.length - 1; index > 0; index -= 1) {
    seed = Math.imul(seed ^ (seed >>> 15), 2246822519)
    const target = Math.abs(seed) % (index + 1)
    ;[next[index], next[target]] = [next[target], next[index]]
  }
  return next
}

function numericFactId(start: number, answer: string): string {
  return `number-${start}-${answer}`
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items))
}

function uniqueNumbers(items: number[]): number[] {
  return unique(items.filter((item) => Number.isFinite(item)).map((item) => Math.round(item * 1000) / 1000))
}
