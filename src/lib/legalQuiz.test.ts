import { describe, expect, it } from 'vitest'
import { createLegalQuizQuestions } from './legalQuiz'
import { extractKeywordTraps } from './keywordTraining'

describe('legal comprehension quiz', () => {
  it('creates questions for elements, legal effects, and penalties', () => {
    const questions = createLegalQuizQuestions('行為人於夜間侵入住宅者，處三年以下有期徒刑。法院得宣告沒收犯罪所得。')
    expect(questions.map((question) => question.kind)).toEqual(['構成要件', '法律效果', '刑罰'])
    expect(questions.every((question) => question.options.includes(question.correct))).toBe(true)
  })
})

describe('legal keyword traps', () => {
  it('extracts 應、得、不得 and preserves the surrounding context', () => {
    const traps = extractKeywordTraps('主管機關應於三日內處理，當事人不得拒絕。')
    expect(traps.map((trap) => trap.answer)).toEqual(['應', '不得'])
    expect(traps[0].context).toContain('應於三日內')
    expect(traps[0].options).toContain('得')
  })
})
