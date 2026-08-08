export interface KeywordTrap {
  id: string
  before: string
  answer: string
  after: string
  context: string
  options: string[]
}

const KEYWORDS = ['不得', '應即', '得', '應']

export function extractKeywordTraps(text: string): KeywordTrap[] {
  const traps: KeywordTrap[] = []
  const pattern = new RegExp(KEYWORDS.join('|'), 'g')
  for (const match of text.matchAll(pattern)) {
    const answer = match[0]
    const start = match.index ?? 0
    const end = start + answer.length
    const before = text.slice(Math.max(0, start - 30), start)
    const after = text.slice(end, Math.min(text.length, end + 42))
    traps.push({
      id: `keyword-${start}-${answer}`,
      before,
      answer,
      after,
      context: `${before}${answer}${after}`,
      options: rotate([answer, ...KEYWORDS.filter((item) => item !== answer)], start % 4),
    })
  }
  return traps.slice(0, 12)
}

function rotate(values: string[], offset: number): string[] {
  const unique = Array.from(new Set(values))
  const start = offset % unique.length
  return unique.slice(start).concat(unique.slice(0, start))
}
