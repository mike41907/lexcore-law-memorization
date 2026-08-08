import { splitBySentence } from './importer'

export type LegalQuestionKind = '構成要件' | '法律效果' | '刑罰'

export interface LegalQuizQuestion {
  id: string
  kind: LegalQuestionKind
  prompt: string
  correct: string
  options: string[]
  explanation: string
}

const ROLE_PATTERNS: Record<LegalQuestionKind, RegExp> = {
  構成要件: /者|行為|違反|意圖|故意|過失|以.+為|於.+時|符合|具備|成立/,
  法律效果: /得|應|不得|視為|無效|撤銷|免除|停止|移送|管轄|準用|處理|返還|沒收|追徵/,
  刑罰: /處.+刑|處.+罰|罰金|罰鍰|拘役|徒刑|沒收|追徵|科以|處以|刑之/,
}

const FALLBACKS: Record<LegalQuestionKind, string[]> = {
  構成要件: ['只要主觀上認為違法即當然成立，不需要符合本條前提。', '本條不要求任何行為、身分或時間要件。', '只要發生結果即可，不必判斷行為人的身分。'],
  法律效果: ['本條僅作為名詞定義，不發生任何法律效果。', '一律改以民事賠償處理，不適用本條效果。', '符合條件後當然免除所有相關義務。'],
  刑罰: ['本條未規定刑罰，應另依相關規定判斷。', '處一年以下有期徒刑。', '處三年以下有期徒刑或拘役。'],
}

export function createLegalQuizQuestions(articleText: string, poolTexts: string[] = []): LegalQuizQuestion[] {
  const sourceSentences = splitBySentence(articleText).map(clean).filter((sentence) => sentence.length >= 4)
  const poolSentences = Array.from(new Set(poolTexts.flatMap((text) => splitBySentence(text).map(clean)).filter((sentence) => sentence.length >= 4)))
  return (Object.keys(ROLE_PATTERNS) as LegalQuestionKind[]).map((kind) => {
    const matching = sourceSentences.filter((sentence) => ROLE_PATTERNS[kind].test(sentence))
    const correct = kind === '刑罰' && !matching.length ? '本條未規定刑罰，應另依相關規定判斷。' : matching[0] ?? sourceSentences[0] ?? '本條未提供可分析的條文內容。'
    const candidates = [
      ...matching.slice(1),
      ...poolSentences.filter((sentence) => sentence !== correct && ROLE_PATTERNS[kind].test(sentence)).slice(0, 8),
      ...FALLBACKS[kind],
    ]
    const options = rotateOptions([correct, ...candidates], seedFor(`${kind}:${articleText}`)).slice(0, 4)
    return {
      id: `${kind}-${hash(articleText)}`,
      kind,
      prompt: promptFor(kind),
      correct,
      options,
      explanation: `正確答案取自本條原文的${kind}相關內容，作答後請回看全文核對。`,
    }
  })
}

function promptFor(kind: LegalQuestionKind): string {
  if (kind === '構成要件') return '下列何者最符合本條的構成要件或適用前提？'
  if (kind === '法律效果') return '符合本條要件後，法律效果或處理方式為何？'
  return '本條規定的刑罰或制裁為何？若本條沒有刑罰，請選出「未規定刑罰」。'
}

function clean(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

function hash(value: string): number {
  return Array.from(value).reduce((sum, character) => (sum * 31 + character.charCodeAt(0)) >>> 0, 7)
}

function seedFor(value: string): number {
  return hash(value) % 97
}

function rotateOptions(values: string[], offset: number): string[] {
  const unique = Array.from(new Set(values.filter(Boolean)))
  if (unique.length <= 1) return unique
  const start = offset % unique.length
  return unique.slice(start).concat(unique.slice(0, start))
}
