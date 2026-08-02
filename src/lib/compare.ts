import type { CompareOptions, ComparisonError, ComparisonResult, DiffPart } from '../types'
import { clamp, gradeForScore } from './utils'

const DEFAULT_OPTIONS: CompareOptions = {
  ignorePunctuation: true,
  ignoreWhitespace: true,
  ignoreLineBreaks: true,
  ignoreFullHalf: true,
  ignoreArabicChineseNumbers: false,
  strictLegalTerms: true,
  strictStructure: true,
}

export function normalizeForCompare(input: string, options: CompareOptions = DEFAULT_OPTIONS): string {
  let output = input.replace(/\r\n/g, '\n')
  if (options.ignoreFullHalf) output = output.normalize('NFKC')
  if (options.ignoreArabicChineseNumbers) output = convertChineseDigits(output)
  if (options.ignoreLineBreaks) output = output.replace(/[\r\n]/g, '')
  if (options.ignoreWhitespace) output = output.replace(/\s+/g, '')
  if (options.ignorePunctuation) output = output.replace(/[\p{P}\p{S}]/gu, '')
  return output
}

export function compareText(
  expected: string,
  actual: string,
  options: CompareOptions = DEFAULT_OPTIONS,
  highWeightKeywords: string[] = [],
  usedHints = 0,
): ComparisonResult {
  const normalizedExpected = normalizeForCompare(expected, options)
  const normalizedActual = normalizeForCompare(actual, options)
  const parts = diffCharacters(normalizedExpected, normalizedActual)
  const missing = parts.filter((part) => part.type === 'missing').map((part) => part.expected).filter(Boolean)
  const extra = parts.filter((part) => part.type === 'extra').map((part) => part.actual).filter(Boolean)
  const replacements = parts
    .filter((part) => part.type === 'replacement')
    .map((part) => ({ expected: part.expected, actual: part.actual }))
  const errors: ComparisonError[] = []
  const keywords = Array.from(new Set(highWeightKeywords.map((item) => item.trim()).filter(Boolean))).sort((a, b) => b.length - a.length)

  for (const part of parts) {
    if (part.type === 'missing') {
      errors.push({ kind: 'missing', expected: part.expected, actual: '', message: `漏寫「${part.expected}」`, isHighWeight: containsKeyword(part.expected, keywords) })
    } else if (part.type === 'extra') {
      errors.push({ kind: 'extra', expected: '', actual: part.actual, message: `多寫「${part.actual}」`, isHighWeight: containsKeyword(part.actual, keywords) })
    } else if (part.type === 'replacement') {
      errors.push({ kind: 'replacement', expected: part.expected, actual: part.actual, message: `「${part.expected}」誤寫為「${part.actual}」`, isHighWeight: containsKeyword(part.expected, keywords) || containsKeyword(part.actual, keywords) })
    }
  }

  const keywordCheck = evaluateKeywords(expected, actual, keywords, options)
  for (const keyword of keywordCheck.errors) {
    if (!errors.some((error) => error.kind === 'keyword' && error.expected === keyword)) {
      errors.push({ kind: 'keyword', expected: keyword, actual: '', message: `高權重關鍵詞「${keyword}」需要重新確認`, isHighWeight: true })
    }
  }

  const structureAccuracy = calculateStructureAccuracy(expected, actual, options)
  if (options.strictStructure && structureAccuracy < 100) {
    errors.push({ kind: 'structure', expected: '項、款、目或順序', actual: '', message: '項、款、目或段落順序與原文不一致', isHighWeight: true })
  }

  const expectedLength = Math.max(normalizedExpected.length, 1)
  const actualLength = Math.max(normalizedActual.length, 1)
  const equalCount = parts.filter((part) => part.type === 'equal').reduce((sum, part) => sum + part.expected.length, 0)
  const accuracy = clamp((equalCount / Math.max(expectedLength, actualLength)) * 100, 0, 100)
  const keywordAccuracy = keywordCheck.accuracy
  const hintScore = 10 * Math.max(0, 1 - usedHints * 0.18)
  let score = accuracy * 0.5 + keywordAccuracy * 0.25 + structureAccuracy * 0.15 + hintScore
  const highWeightError = errors.some((error) => error.isHighWeight)
  if (highWeightError) score = Math.min(score, 94)
  score = Math.round(clamp(score, 0, 100) * 10) / 10

  return {
    expected,
    actual,
    normalizedExpected,
    normalizedActual,
    parts,
    errors,
    missing,
    extra,
    replacements,
    accuracy: round(accuracy),
    keywordAccuracy: round(keywordAccuracy),
    structureAccuracy: round(structureAccuracy),
    score,
    grade: gradeForScore(score),
    highWeightError,
    usedHints,
  }
}

export function diffCharacters(expected: string, actual: string): DiffPart[] {
  const rows = expected.length + 1
  const columns = actual.length + 1
  const matrix: number[][] = Array.from({ length: rows }, () => Array<number>(columns).fill(0))
  for (let row = 0; row < rows; row += 1) matrix[row][0] = row
  for (let column = 0; column < columns; column += 1) matrix[0][column] = column
  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const substitution = matrix[row - 1][column - 1] + (expected[row - 1] === actual[column - 1] ? 0 : 1)
      matrix[row][column] = Math.min(substitution, matrix[row - 1][column] + 1, matrix[row][column - 1] + 1)
    }
  }

  const reverseParts: DiffPart[] = []
  let row = expected.length
  let column = actual.length
  while (row > 0 || column > 0) {
    if (row > 0 && column > 0 && expected[row - 1] === actual[column - 1]) {
      addPart(reverseParts, { type: 'equal', expected: expected[row - 1], actual: actual[column - 1] })
      row -= 1
      column -= 1
      continue
    }
    const substitution = row > 0 && column > 0 ? matrix[row - 1][column - 1] + 1 : Number.POSITIVE_INFINITY
    const deletion = row > 0 ? matrix[row - 1][column] + 1 : Number.POSITIVE_INFINITY
    const insertion = column > 0 ? matrix[row][column - 1] + 1 : Number.POSITIVE_INFINITY
    if (substitution <= deletion && substitution <= insertion) {
      addPart(reverseParts, { type: 'replacement', expected: expected[row - 1], actual: actual[column - 1] })
      row -= 1
      column -= 1
    } else if (deletion <= insertion) {
      addPart(reverseParts, { type: 'missing', expected: expected[row - 1], actual: '' })
      row -= 1
    } else {
      addPart(reverseParts, { type: 'extra', expected: '', actual: actual[column - 1] })
      column -= 1
    }
  }
  return reverseParts.reverse()
}

export function calculateStructureAccuracy(expected: string, actual: string, options: CompareOptions = DEFAULT_OPTIONS): number {
  if (!options.strictStructure) return 100
  const expectedTokens = extractStructureTokens(expected)
  const actualTokens = extractStructureTokens(actual)
  if (!expectedTokens.length) return 100
  if (expectedTokens.join('|') === actualTokens.join('|')) return 100
  let same = 0
  expectedTokens.forEach((token, index) => {
    if (token === actualTokens[index]) same += 1
  })
  return clamp((same / expectedTokens.length) * 100, 0, 100)
}

function extractStructureTokens(value: string): string[] {
  return value.match(/(?:第\s*[0-9０-９一二三四五六七八九十百千〇零○]+\s*條)|(?:[（(]?[一二三四五六七八九十百千0-9０-９]+[）)、.．])|(?:[（(]?[甲乙丙丁戊己庚辛壬癸]+[）)、.．])/g) ?? []
}

function evaluateKeywords(expected: string, actual: string, keywords: string[], options: CompareOptions): { accuracy: number; errors: string[] } {
  if (!options.strictLegalTerms || !keywords.length) return { accuracy: 100, errors: [] }
  let expectedTotal = 0
  let matched = 0
  const errors: string[] = []
  for (const keyword of keywords) {
    const expectedCount = occurrences(expected, keyword)
    const actualCount = occurrences(actual, keyword)
    expectedTotal += expectedCount
    matched += Math.min(expectedCount, actualCount)
    if (expectedCount !== actualCount) errors.push(keyword)
  }
  if (!expectedTotal) return { accuracy: 100, errors: [] }
  const extraKeywordCount = keywords.reduce((sum, keyword) => {
    const expectedCount = occurrences(expected, keyword)
    const actualCount = occurrences(actual, keyword)
    return sum + Math.max(0, actualCount - expectedCount)
  }, 0)
  return { accuracy: clamp((matched / Math.max(expectedTotal, matched + extraKeywordCount)) * 100, 0, 100), errors }
}

function occurrences(value: string, keyword: string): number {
  if (!keyword) return 0
  let count = 0
  let start = 0
  while (start <= value.length - keyword.length) {
    const found = value.indexOf(keyword, start)
    if (found < 0) break
    count += 1
    start = found + keyword.length
  }
  return count
}

function containsKeyword(value: string, keywords: string[]): boolean {
  return keywords.some((keyword) => value.includes(keyword))
}

function addPart(parts: DiffPart[], part: DiffPart): void {
  const previous = parts[parts.length - 1]
  if (previous && previous.type === part.type) {
    previous.expected = part.expected + previous.expected
    previous.actual = part.actual + previous.actual
  } else {
    parts.push(part)
  }
}

function convertChineseDigits(value: string): string {
  const map: Record<string, string> = { '零': '0', '〇': '0', '○': '0', '一': '1', '二': '2', '三': '3', '四': '4', '五': '5', '六': '6', '七': '7', '八': '8', '九': '9' }
  return value.replace(/[零〇○一二三四五六七八九]/g, (character) => map[character] ?? character)
}

function round(value: number): number {
  return Math.round(value * 10) / 10
}
