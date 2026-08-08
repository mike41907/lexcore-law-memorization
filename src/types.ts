export type ISODate = string
export type TrainingMode = 'reading' | 'comprehension' | 'numbers' | 'keywords' | 'cloze' | 'ordering' | 'prompt' | 'dictation' | 'surprise'
export type ArticleStatus = '未開始' | '初次接觸' | '學習中' | '尚未穩定' | '接近熟練' | '已熟練' | '已精通' | '高風險' | '需要重新學習'
export type TaskType = 'new' | 'due' | 'yesterday-error' | 'seven-day' | 'high-risk' | 'surprise' | 'mastery-check'
export type ErrorKind = 'missing' | 'extra' | 'replacement' | 'order' | 'keyword' | 'structure'

export interface CompareOptions {
  ignorePunctuation: boolean
  ignoreWhitespace: boolean
  ignoreLineBreaks: boolean
  ignoreFullHalf: boolean
  ignoreArabicChineseNumbers: boolean
  strictLegalTerms: boolean
  strictStructure: boolean
}

export interface MasteryWeights {
  reading: number
  cloze: number
  ordering: number
  prompt: number
  dictation: number
  stability: number
}

export interface AppSettings {
  id: 'settings'
  examDate: string
  dailyStudyMinutes: number
  dailyNewArticles: number
  dailyReviewLimit: number
  includeMandatoryFirst: boolean
  enableSurprise: boolean
  surpriseQuestions: number
  fontScale: number
  soundEnabled: boolean
  animationsEnabled: boolean
  compare: CompareOptions
  masteryWeights: MasteryWeights
  reviewIntervals: number[]
  highWeightKeywords: string[]
  createdAt: ISODate
  updatedAt: ISODate
}

export interface OfficialImportSource {
  type: 'moj-law'
  provider: '法務部全國法規資料庫'
  lawCode: string
  lawUrl: string
  dataUpdatedAt: string
  retrievedAt: ISODate
}

export interface LawCollection {
  id: string
  name: string
  shortName: string
  category: string
  importance: 1 | 2 | 3 | 4 | 5
  examScope: boolean
  notes: string
  source?: OfficialImportSource
  createdAt: ISODate
  updatedAt: ISODate
  deletedAt?: ISODate
}

export interface LawArticle {
  id: string
  lawId: string
  articleNumber: string
  title: string
  text: string
  notes: string
  questions?: string[]
  importance: 1 | 2 | 3 | 4 | 5
  mustMemorize: boolean
  includeDaily: boolean
  tags: string[]
  isBoss: boolean
  source?: OfficialImportSource
  createdAt: ISODate
  updatedAt: ISODate
  deletedAt?: ISODate
}

export interface ArticleSection {
  id: string
  articleId: string
  order: number
  type: 'paragraph' | 'item' | 'subitem' | 'title'
  text: string
}

export interface DiffPart {
  type: 'equal' | 'missing' | 'extra' | 'replacement'
  expected: string
  actual: string
}

export interface ComparisonError {
  kind: ErrorKind
  expected: string
  actual: string
  message: string
  isHighWeight: boolean
}

export interface ComparisonResult {
  expected: string
  actual: string
  normalizedExpected: string
  normalizedActual: string
  parts: DiffPart[]
  errors: ComparisonError[]
  missing: string[]
  extra: string[]
  replacements: Array<{ expected: string; actual: string }>
  accuracy: number
  keywordAccuracy: number
  structureAccuracy: number
  score: number
  grade: 'S' | 'A' | 'B' | 'C' | 'D' | 'E'
  highWeightError: boolean
  usedHints: number
}

export interface StudySession {
  id: string
  articleId: string
  lawId: string
  mode: TrainingMode
  startedAt: ISODate
  completedAt: ISODate
  durationSeconds: number
  score: number
  usedHints: number
  completed: boolean
}

export interface AnswerRecord {
  id: string
  articleId: string
  lawId: string
  mode: TrainingMode
  originalText: string
  userAnswer: string
  comparison: ComparisonResult
  score: number
  accuracy: number
  keywordAccuracy: number
  structureAccuracy: number
  usedHints: number
  durationSeconds: number
  completed: boolean
  createdAt: ISODate
}

export interface ErrorRecord {
  id: string
  answerId: string
  articleId: string
  lawId: string
  mode: TrainingMode
  originalText: string
  userAnswer: string
  errors: ComparisonError[]
  missing: string[]
  extra: string[]
  replacements: Array<{ expected: string; actual: string }>
  keywordErrors: string[]
  accuracy: number
  durationSeconds: number
  usedHints: number
  createdAt: ISODate
}

export interface ReviewSchedule {
  id: string
  articleId: string
  stage: number
  intervalDays: number
  nextReviewAt: ISODate
  lastReviewedAt?: ISODate
  lastScore?: number
  consecutiveCorrect: number
  lapses: number
  crossDayPasses: number
}

export interface MasteryRecord {
  id: string
  articleId: string
  score: number
  status: ArticleStatus
  attempts: number
  reads: number
  clozeAverage: number
  orderingAverage: number
  promptAverage: number
  dictationAverage: number
  stabilityScore: number
  consecutiveCorrect: number
  crossDayPasses: number
  fullDictationDates: string[]
  fullDictationStreak: number
  bestSevenDayScore: number
  keywordErrorCount: number
  structureErrorCount: number
  errorFrequency: number
  lastScore: number
  lastReviewAt?: ISODate
  updatedAt: ISODate
}

export interface DailyTask {
  id: string
  date: string
  articleId: string
  type: TaskType
  estimatedMinutes: number
  completed: boolean
  completedAt?: ISODate
  createdAt: ISODate
}

export interface Achievement {
  id: string
  key: string
  title: string
  description: string
  unlockedAt?: ISODate
}

export interface ConfusionGroup {
  id: string
  name: string
  reason: string
  articleIds: string[]
  notes: string
  createdAt: ISODate
  updatedAt: ISODate
}

export interface UserProgress {
  id: 'progress'
  level: number
  experience: number
  streakDays: number
  totalStudyDays: number
  totalAnswers: number
  combo: number
  lastStudyDate?: string
  studyDates: string[]
  lastEarnedAt?: ISODate
}

export interface BackupData {
  format: 'lexcore-backup'
  version: string
  exportedAt: ISODate
  settings: AppSettings
  laws: LawCollection[]
  articles: LawArticle[]
  sections: ArticleSection[]
  sessions: StudySession[]
  answers: AnswerRecord[]
  errors: ErrorRecord[]
  reviews: ReviewSchedule[]
  mastery: MasteryRecord[]
  tasks: DailyTask[]
  achievements: Achievement[]
  confusions: ConfusionGroup[]
  progress: UserProgress
}

export interface ImportArticleDraft {
  articleNumber: string
  title: string
  text: string
  notes: string
  importance: 1 | 2 | 3 | 4 | 5
  mustMemorize: boolean
  includeDaily: boolean
  source?: OfficialImportSource
}

export interface SubmissionResult {
  answer: AnswerRecord
  mastery: MasteryRecord
  review: ReviewSchedule
  unlockedAchievements: Achievement[]
}

export const DEFAULT_COMPARE_OPTIONS: CompareOptions = {
  ignorePunctuation: true,
  ignoreWhitespace: true,
  ignoreLineBreaks: true,
  ignoreFullHalf: true,
  ignoreArabicChineseNumbers: false,
  strictLegalTerms: true,
  strictStructure: true,
}

export const DEFAULT_MASTERY_WEIGHTS: MasteryWeights = {
  reading: 0.05,
  cloze: 0.15,
  ordering: 0.15,
  prompt: 0.2,
  dictation: 0.35,
  stability: 0.1,
}

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'settings',
  examDate: '2027-03-01',
  dailyStudyMinutes: 30,
  dailyNewArticles: 3,
  dailyReviewLimit: 15,
  includeMandatoryFirst: true,
  enableSurprise: false,
  surpriseQuestions: 3,
  fontScale: 1,
  soundEnabled: false,
  animationsEnabled: true,
  compare: DEFAULT_COMPARE_OPTIONS,
  masteryWeights: DEFAULT_MASTERY_WEIGHTS,
  reviewIntervals: [0.007, 1, 3, 7, 14, 30, 60, 90],
  highWeightKeywords: ['得', '應', '不得', '應即', '必要時', '於', '及', '或', '與', '之', '其', '前項', '前條', '但書', '除外', '項', '款', '目'],
  createdAt: '',
  updatedAt: '',
}

export const DEFAULT_PROGRESS: UserProgress = {
  id: 'progress',
  level: 1,
  experience: 0,
  streakDays: 0,
  totalStudyDays: 0,
  totalAnswers: 0,
  combo: 0,
  studyDates: [],
}

export const ACHIEVEMENT_DEFINITIONS: Array<Pick<Achievement, 'key' | 'title' | 'description'>> = [
  { key: 'first-article', title: '初次落筆', description: '完成第一條法條的訓練。' },
  { key: 'first-dictation', title: '第一次理解驗證', description: '完成第一次構成要件、法律效果與刑罰驗證。' },
  { key: 'first-perfect', title: '毫釐不差', description: '第一次取得 100 分。' },
  { key: 'streak-3', title: '三日不斷', description: '連續學習 3 天。' },
  { key: 'streak-7', title: '七日鍛鍊', description: '連續學習 7 天。' },
  { key: 'answers-100', title: '百次淬鍊', description: '完成 100 次答題。' },
  { key: 'mastery-10', title: '十條精通', description: '精通 10 條法條。' },
  { key: 'first-surprise', title: '突擊應戰', description: '完成第一次突擊抽考。' },
  { key: 'first-boss', title: '擊破魔王', description: '以 95 分以上擊敗一條魔王法條。' },
]
