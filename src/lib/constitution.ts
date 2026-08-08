import type { LawArticle, LawCollection } from '../types'
import { normalizeArticleNumber } from './importer'

export const CONSTITUTION_CODE = 'A0000001'
export const CONSTITUTION_ADDITIONAL_CODE = 'A0000002'

export function extractStoppedConstitutionArticleNumbers(texts: string[]): Set<string> {
  const stopped = new Set<string>()
  for (const text of texts) {
    for (const clause of text.split(/[。；]/).filter((part) => part.includes('停止適用'))) {
      // 第 85 條只停止其中一段選舉規定，不能因此隱藏整條憲法第 85 條。
      if (clause.includes('有關')) continue
      const references = Array.from(clause.matchAll(/(?:憲法)?第([一二三四五六七八九十百零〇0-9]+)條(?:至第([一二三四五六七八九十百零〇0-9]+)條)?/g))
      for (const reference of references) {
        const first = chineseOrArabicNumber(reference[1])
        const last = reference[2] ? chineseOrArabicNumber(reference[2]) : first
        if (first === null || last === null || last < first || last - first > 300) continue
        for (let number = first; number <= last; number += 1) stopped.add(String(number))
      }
    }
  }
  return stopped
}

export function findStoppedConstitutionArticles(laws: LawCollection[], articles: LawArticle[]): LawArticle[] {
  const constitutionLawIds = new Set(laws.filter((law) => law.source?.lawCode === CONSTITUTION_CODE || law.name === '中華民國憲法').map((law) => law.id))
  const amendmentLawIds = new Set(laws.filter((law) => law.source?.lawCode === CONSTITUTION_ADDITIONAL_CODE || law.name === '中華民國憲法增修條文').map((law) => law.id))
  if (!constitutionLawIds.size || !amendmentLawIds.size) return []
  const stopped = extractStoppedConstitutionArticleNumbers(articles.filter((article) => amendmentLawIds.has(article.lawId) && !article.deletedAt).map((article) => article.text))
  return articles.filter((article) => constitutionLawIds.has(article.lawId) && !article.deletedAt && stopped.has(normalizeArticleNumber(article.articleNumber)))
}

export function chineseOrArabicNumber(value: string): number | null {
  if (/^\d+$/.test(value)) return Number(value)
  const digits: Record<string, number> = { 零: 0, 〇: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 }
  let section = 0
  let number = 0
  for (const character of value) {
    if (character in digits) number = number * 10 + digits[character]
    else if (character === '十') { section += (number || 1) * 10; number = 0 }
    else if (character === '百') { section += (number || 1) * 100; number = 0 }
    else return null
  }
  return section + number || null
}
