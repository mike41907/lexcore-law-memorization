import { createContext, useCallback, useContext, useEffect, useMemo, useState, type PropsWithChildren } from 'react'
import type {
  Achievement,
  AnswerRecord,
  AppSettings,
  ArticleSection,
  BackupData,
  ComparisonResult,
  ConfusionGroup,
  DailyTask,
  ErrorRecord,
  ImportArticleDraft,
  LawArticle,
  LawCollection,
  MasteryRecord,
  ReviewSchedule,
  StudySession,
  TrainingMode,
  UserProgress,
} from '../types'
import { clearStore, getAll, put, putMany, readSnapshot, remove, STORE_NAMES, type DatabaseSnapshot } from '../lib/db'
import { createBackup, parseBackup } from '../lib/backup'
import { normalizeArticleNumber, splitIntoSections } from '../lib/importer'
import { applyReadToMastery, createInitialMastery, updateMastery } from '../lib/mastery'
import { calculateNextReview } from '../lib/scheduler'
import { generateDailyTasks } from '../lib/tasks'
import { createDemoData } from '../lib/sampleData'
import { compareText } from '../lib/compare'
import { DEFAULT_PROGRESS, DEFAULT_SETTINGS, ACHIEVEMENT_DEFINITIONS } from '../types'
import { dateDiffInDays, makeId, normalizeSettings, nowIso, todayKey } from '../lib/utils'

export interface AppState {
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

interface CreateLawInput {
  name: string
  shortName: string
  category: string
  importance: 1 | 2 | 3 | 4 | 5
  examScope: boolean
  notes: string
  source?: LawCollection['source']
}

interface AppContextValue extends AppState {
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  createLaw: (input: CreateLawInput) => Promise<LawCollection>
  updateLaw: (law: LawCollection) => Promise<void>
  deleteLaw: (lawId: string) => Promise<void>
  saveImportedArticles: (lawId: string, drafts: ImportArticleDraft[]) => Promise<void>
  updateArticle: (article: LawArticle) => Promise<void>
  deleteArticle: (articleId: string) => Promise<void>
  markRead: (articleId: string, durationSeconds?: number) => Promise<void>
  submitTraining: (input: { article: LawArticle; mode: TrainingMode; answer: string; usedHints: number; durationSeconds: number; originalText?: string }) => Promise<{ answer: AnswerRecord; mastery: MasteryRecord; review: ReviewSchedule; unlockedAchievements: Achievement[] }>
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>
  exportBackup: () => Promise<BackupData>
  restoreBackup: (raw: string, mode: 'overwrite' | 'merge') => Promise<void>
  resetSystem: () => Promise<void>
  loadDemoData: () => Promise<void>
  toggleTask: (task: DailyTask) => Promise<void>
  createConfusionGroup: (input: Pick<ConfusionGroup, 'name' | 'reason' | 'articleIds' | 'notes'>) => Promise<void>
  deleteConfusionGroup: (id: string) => Promise<void>
}

const AppContext = createContext<AppContextValue | undefined>(undefined)

export function AppProvider({ children }: PropsWithChildren): JSX.Element {
  const [state, setState] = useState<AppState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadState = useCallback(async (): Promise<void> => {
    setLoading(true)
    try {
      const snapshot = await readSnapshot()
      const timestamp = nowIso()
      const settings = normalizeSettings(snapshot.settings[0] ? { ...DEFAULT_SETTINGS, ...snapshot.settings[0] } : { ...DEFAULT_SETTINGS, createdAt: timestamp, updatedAt: timestamp })
      const progress = snapshot.progress[0] ?? { ...DEFAULT_PROGRESS }
      if (!snapshot.settings[0]) await put(STORE_NAMES.settings, settings)
      if (!snapshot.progress[0]) await put(STORE_NAMES.progress, progress)

      let tasks = snapshot.tasks
      const date = todayKey()
      if (snapshot.articles.some((article) => !article.deletedAt)) {
        const generated = generateDailyTasks(snapshot.articles, snapshot.reviews, snapshot.mastery, settings, date)
        const existingTodayKeys = new Set(tasks.filter((task) => task.date === date).map((task) => `${task.articleId}:${task.type}`))
        const additions = generated.filter((task) => !existingTodayKeys.has(`${task.articleId}:${task.type}`))
        if (additions.length) {
          await putMany(STORE_NAMES.tasks, additions)
          tasks = [...tasks, ...additions]
        }
      }
      setState({
        settings,
        laws: snapshot.laws,
        articles: snapshot.articles,
        sections: snapshot.sections,
        sessions: snapshot.sessions,
        answers: snapshot.answers,
        errors: snapshot.errors,
        reviews: snapshot.reviews,
        mastery: snapshot.mastery,
        tasks,
        achievements: snapshot.achievements,
        confusions: snapshot.confusions,
        progress,
      })
      setError(null)
    } catch (caught) {
      setError(toErrorMessage(caught))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadState()
  }, [loadState])

  const refresh = useCallback(async () => loadState(), [loadState])

  const createLaw = useCallback(async (input: CreateLawInput): Promise<LawCollection> => {
    const current = requireState(state)
    const name = input.name.trim()
    if (!name) throw new Error('法規名稱不可空白。')
    if (current.laws.some((law) => !law.deletedAt && law.name.trim().toLowerCase() === name.toLowerCase())) throw new Error('法規名稱重複，請改用其他名稱。')
    const timestamp = nowIso()
    const law: LawCollection = { id: makeId('law'), ...input, name, shortName: input.shortName.trim() || name, category: input.category.trim() || '未分類', notes: input.notes.trim(), createdAt: timestamp, updatedAt: timestamp }
    await put(STORE_NAMES.laws, law)
    await loadState()
    return law
  }, [loadState, state])

  const updateLaw = useCallback(async (law: LawCollection): Promise<void> => {
    const current = requireState(state)
    const name = law.name.trim()
    if (!name) throw new Error('法規名稱不可空白。')
    if (current.laws.some((item) => item.id !== law.id && !item.deletedAt && item.name.trim().toLowerCase() === name.toLowerCase())) throw new Error('法規名稱重複，請改用其他名稱。')
    await put(STORE_NAMES.laws, { ...law, name, shortName: law.shortName.trim() || name, updatedAt: nowIso() })
    await loadState()
  }, [loadState, state])

  const deleteLaw = useCallback(async (lawId: string): Promise<void> => {
    const current = requireState(state)
    const law = current.laws.find((item) => item.id === lawId)
    if (!law) return
    const timestamp = nowIso()
    await put(STORE_NAMES.laws, { ...law, deletedAt: timestamp, updatedAt: timestamp })
    await Promise.all(current.articles.filter((article) => article.lawId === lawId && !article.deletedAt).map((article) => put(STORE_NAMES.articles, { ...article, deletedAt: timestamp, updatedAt: timestamp })))
    await loadState()
  }, [loadState, state])

  const saveImportedArticles = useCallback(async (lawId: string, drafts: ImportArticleDraft[]): Promise<void> => {
    const current = requireState(state)
    if (!current.laws.some((law) => law.id === lawId && !law.deletedAt)) throw new Error('找不到可用的法規，請先建立法規。')
    if (!drafts.length) throw new Error('沒有可儲存的法條。')
    const existing = current.articles.filter((article) => article.lawId === lawId && !article.deletedAt)
    const seen = new Set(existing.map((article) => normalizeArticleNumber(article.articleNumber)))
    const timestamp = nowIso()
    const articles: LawArticle[] = []
    const sections: ArticleSection[] = []
    for (const draft of drafts) {
      const number = draft.articleNumber.trim() || '未編號'
      const numberKey = normalizeArticleNumber(number)
      if (seen.has(numberKey)) throw new Error(`條號「${number}」重複，請在預覽中修改後再儲存。`)
      seen.add(numberKey)
      const article: LawArticle = {
        id: makeId('article'),
        lawId,
        articleNumber: number,
        title: draft.title.trim(),
        text: draft.text.trim(),
        notes: draft.notes.trim(),
        importance: draft.importance,
        mustMemorize: draft.mustMemorize,
        includeDaily: draft.includeDaily,
        tags: [],
        isBoss: false,
        source: draft.source,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
      if (!article.text) throw new Error(`條號「${number}」的條文內容不可空白。`)
      articles.push(article)
      sections.push(...splitIntoSections(article.text, article.id))
    }
    await putMany(STORE_NAMES.articles, articles)
    await putMany(STORE_NAMES.sections, sections)
    await loadState()
  }, [loadState, state])

  const updateArticle = useCallback(async (article: LawArticle): Promise<void> => {
    if (!article.text.trim()) throw new Error('法條全文不可空白。')
    await put(STORE_NAMES.articles, { ...article, articleNumber: article.articleNumber.trim() || '未編號', text: article.text.trim(), updatedAt: nowIso() })
    const oldSections = await getAll<ArticleSection>(STORE_NAMES.sections)
    await Promise.all(oldSections.filter((section) => section.articleId === article.id).map((section) => remove(STORE_NAMES.sections, section.id)))
    await putMany(STORE_NAMES.sections, splitIntoSections(article.text, article.id))
    await loadState()
  }, [loadState])

  const deleteArticle = useCallback(async (articleId: string): Promise<void> => {
    const current = requireState(state)
    const article = current.articles.find((item) => item.id === articleId)
    if (!article) return
    await put(STORE_NAMES.articles, { ...article, deletedAt: nowIso(), updatedAt: nowIso() })
    await loadState()
  }, [loadState, state])

  const markRead = useCallback(async (articleId: string, durationSeconds = 0): Promise<void> => {
    const current = requireState(state)
    const article = current.articles.find((item) => item.id === articleId)
    if (!article) throw new Error('找不到指定法條。')
    const previous = current.mastery.find((item) => item.articleId === articleId)
    const mastery = applyReadToMastery(previous, articleId)
    const timestamp = nowIso()
    const session: StudySession = { id: makeId('session'), articleId, lawId: article.lawId, mode: 'reading', startedAt: timestamp, completedAt: timestamp, durationSeconds, score: 0, usedHints: 0, completed: true }
    await put(STORE_NAMES.mastery, mastery)
    await put(STORE_NAMES.sessions, session)
    await loadState()
  }, [loadState, state])

  const submitTraining = useCallback(async (input: { article: LawArticle; mode: TrainingMode; answer: string; usedHints: number; durationSeconds: number; originalText?: string }): Promise<{ answer: AnswerRecord; mastery: MasteryRecord; review: ReviewSchedule; unlockedAchievements: Achievement[] }> => {
    const current = requireState(state)
    const timestamp = nowIso()
    const comparison: ComparisonResult = compareText(input.originalText ?? input.article.text, input.answer, current.settings.compare, current.settings.highWeightKeywords, input.usedHints)
    const answer: AnswerRecord = {
      id: makeId('answer'),
      articleId: input.article.id,
      lawId: input.article.lawId,
      mode: input.mode,
      originalText: input.originalText ?? input.article.text,
      userAnswer: input.answer,
      comparison,
      score: comparison.score,
      accuracy: comparison.accuracy,
      keywordAccuracy: comparison.keywordAccuracy,
      structureAccuracy: comparison.structureAccuracy,
      usedHints: input.usedHints,
      durationSeconds: input.durationSeconds,
      completed: true,
      createdAt: timestamp,
    }
    const previousReview = current.reviews.find((review) => review.articleId === input.article.id)
    const review = calculateNextReview({ articleId: input.article.id, previous: previousReview, answer, mastery: current.mastery.find((item) => item.articleId === input.article.id) ?? createInitialMastery(input.article.id), settings: current.settings })
    let mastery = updateMastery(current.mastery.find((item) => item.articleId === input.article.id), answer, current.settings, review)
    if (previousReview && previousReview.intervalDays >= 7 && answer.score >= 90) mastery = { ...mastery, bestSevenDayScore: Math.max(mastery.bestSevenDayScore, answer.score) }
    const session: StudySession = { id: makeId('session'), articleId: input.article.id, lawId: input.article.lawId, mode: input.mode, startedAt: new Date(Date.now() - input.durationSeconds * 1000).toISOString(), completedAt: timestamp, durationSeconds: input.durationSeconds, score: answer.score, usedHints: input.usedHints, completed: true }
    await put(STORE_NAMES.answers, answer)
    await put(STORE_NAMES.sessions, session)
    await put(STORE_NAMES.reviews, review)
    await put(STORE_NAMES.mastery, mastery)
    if (comparison.errors.length) {
      const error: ErrorRecord = {
        id: makeId('error'),
        answerId: answer.id,
        articleId: input.article.id,
        lawId: input.article.lawId,
        mode: input.mode,
        originalText: answer.originalText,
        userAnswer: input.answer,
        errors: comparison.errors,
        missing: comparison.missing,
        extra: comparison.extra,
        replacements: comparison.replacements,
        keywordErrors: comparison.errors.filter((item) => item.isHighWeight).map((item) => item.expected || item.actual),
        accuracy: comparison.accuracy,
        durationSeconds: input.durationSeconds,
        usedHints: input.usedHints,
        createdAt: timestamp,
      }
      await put(STORE_NAMES.errors, error)
    }
    const nextProgress = updateProgress(current.progress, answer, timestamp)
    await put(STORE_NAMES.progress, nextProgress)
    const task = current.tasks.find((item) => item.date === todayKey() && item.articleId === input.article.id && !item.completed)
    if (task) await put(STORE_NAMES.tasks, { ...task, completed: true, completedAt: timestamp })
    const unlockedAchievements = await unlockAchievements({ current, nextProgress, answer, article: input.article, mastery })
    await loadState()
    return { answer, mastery, review, unlockedAchievements }
  }, [loadState, state])

  const updateSettings = useCallback(async (patch: Partial<AppSettings>): Promise<void> => {
    const current = requireState(state)
    const settings = normalizeSettings({ ...current.settings, ...patch, compare: { ...current.settings.compare, ...(patch.compare ?? {}) }, masteryWeights: { ...current.settings.masteryWeights, ...(patch.masteryWeights ?? {}) }, updatedAt: nowIso() })
    await put(STORE_NAMES.settings, settings)
    await loadState()
  }, [loadState, state])

  const exportBackup = useCallback(async (): Promise<BackupData> => createBackup(await readSnapshot()), [])

  const restoreBackup = useCallback(async (raw: string, mode: 'overwrite' | 'merge'): Promise<void> => {
    const backup = parseBackup(raw)
    if (mode === 'overwrite') {
      await clearAllStores()
      await put(STORE_NAMES.settings, backup.settings)
      await put(STORE_NAMES.progress, backup.progress)
      await Promise.all([
        putMany(STORE_NAMES.laws, backup.laws), putMany(STORE_NAMES.articles, backup.articles), putMany(STORE_NAMES.sections, backup.sections), putMany(STORE_NAMES.sessions, backup.sessions), putMany(STORE_NAMES.answers, backup.answers), putMany(STORE_NAMES.errors, backup.errors), putMany(STORE_NAMES.reviews, backup.reviews), putMany(STORE_NAMES.mastery, backup.mastery), putMany(STORE_NAMES.tasks, backup.tasks), putMany(STORE_NAMES.achievements, backup.achievements), putMany(STORE_NAMES.confusions, backup.confusions),
      ])
    } else {
      const existing = await readSnapshot()
      const lawIdMap = new Map<string, string>()
      const existingLawByName = new Map(existing.laws.map((law) => [law.name.trim().toLowerCase(), law.id]))
      backup.laws.forEach((law) => lawIdMap.set(law.id, existingLawByName.get(law.name.trim().toLowerCase()) ?? law.id))
      await mergeRecords(STORE_NAMES.laws, existing.laws, backup.laws, (item) => item.name.trim().toLowerCase())

      const incomingArticles = backup.articles.map((article) => ({ ...article, lawId: lawIdMap.get(article.lawId) ?? article.lawId }))
      const existingArticleByKey = new Map(existing.articles.map((article) => [`${article.lawId}:${article.articleNumber}`, article.id]))
      const articleIdMap = new Map<string, string>()
      incomingArticles.forEach((article) => articleIdMap.set(article.id, existingArticleByKey.get(`${article.lawId}:${article.articleNumber}`) ?? article.id))
      await mergeRecords(STORE_NAMES.articles, existing.articles, incomingArticles, (item) => `${item.lawId}:${item.articleNumber}`)

      const incomingSections = backup.sections.map((section) => ({ ...section, articleId: articleIdMap.get(section.articleId) ?? section.articleId }))
      await mergeRecords(STORE_NAMES.sections, existing.sections, incomingSections, (item) => `${item.articleId}:${item.order}`)
      const incomingSessions = backup.sessions.map((session) => ({ ...session, articleId: articleIdMap.get(session.articleId) ?? session.articleId, lawId: lawIdMap.get(session.lawId) ?? session.lawId }))
      const incomingAnswers = backup.answers.map((answer) => ({ ...answer, articleId: articleIdMap.get(answer.articleId) ?? answer.articleId, lawId: lawIdMap.get(answer.lawId) ?? answer.lawId }))
      const incomingErrors = backup.errors.map((item) => ({ ...item, articleId: articleIdMap.get(item.articleId) ?? item.articleId, lawId: lawIdMap.get(item.lawId) ?? item.lawId }))
      const incomingReviews = backup.reviews.map((item) => ({ ...item, articleId: articleIdMap.get(item.articleId) ?? item.articleId }))
      const incomingMastery = backup.mastery.map((item) => ({ ...item, articleId: articleIdMap.get(item.articleId) ?? item.articleId }))
      const incomingTasks = backup.tasks.map((item) => ({ ...item, articleId: articleIdMap.get(item.articleId) ?? item.articleId }))
      await mergeRecords(STORE_NAMES.sessions, existing.sessions, incomingSessions, (item) => item.id)
      await mergeRecords(STORE_NAMES.answers, existing.answers, incomingAnswers, (item) => item.id)
      await mergeRecords(STORE_NAMES.errors, existing.errors, incomingErrors, (item) => item.id)
      await mergeRecords(STORE_NAMES.reviews, existing.reviews, incomingReviews, (item) => item.articleId)
      await mergeRecords(STORE_NAMES.mastery, existing.mastery, incomingMastery, (item) => item.articleId)
      await mergeRecords(STORE_NAMES.tasks, existing.tasks, incomingTasks, (item) => `${item.date}:${item.articleId}:${item.type}`)
      await mergeRecords(STORE_NAMES.achievements, existing.achievements, backup.achievements, (item) => item.key)
      await mergeRecords(STORE_NAMES.confusions, existing.confusions, backup.confusions, (item) => item.id)
    }
    await loadState()
  }, [loadState])

  const resetSystem = useCallback(async (): Promise<void> => {
    await clearAllStores()
    const timestamp = nowIso()
    await put(STORE_NAMES.settings, { ...DEFAULT_SETTINGS, createdAt: timestamp, updatedAt: timestamp })
    await put(STORE_NAMES.progress, { ...DEFAULT_PROGRESS })
    await loadState()
  }, [loadState])

  const loadDemoData = useCallback(async (): Promise<void> => {
    const demo = createDemoData()
    await put(STORE_NAMES.laws, demo.law)
    const sections = demo.articles.flatMap((article) => splitIntoSections(article.text, article.id))
    await putMany(STORE_NAMES.articles, demo.articles)
    await putMany(STORE_NAMES.sections, sections)
    await loadState()
  }, [loadState])

  const toggleTask = useCallback(async (task: DailyTask): Promise<void> => {
    await put(STORE_NAMES.tasks, { ...task, completed: !task.completed, completedAt: task.completed ? undefined : nowIso() })
    await loadState()
  }, [loadState])

  const createConfusionGroup = useCallback(async (input: Pick<ConfusionGroup, 'name' | 'reason' | 'articleIds' | 'notes'>): Promise<void> => {
    if (input.articleIds.length < 2) throw new Error('易混淆法條組至少需要兩條法條。')
    const timestamp = nowIso()
    await put(STORE_NAMES.confusions, { ...input, id: makeId('confusion'), createdAt: timestamp, updatedAt: timestamp })
    await loadState()
  }, [loadState])

  const deleteConfusionGroup = useCallback(async (id: string): Promise<void> => {
    await remove(STORE_NAMES.confusions, id)
    await loadState()
  }, [loadState])

  const value = useMemo<AppContextValue | undefined>(() => {
    if (!state) return undefined
    return { ...state, loading, error, refresh, createLaw, updateLaw, deleteLaw, saveImportedArticles, updateArticle, deleteArticle, markRead, submitTraining, updateSettings, exportBackup, restoreBackup, resetSystem, loadDemoData, toggleTask, createConfusionGroup, deleteConfusionGroup }
  }, [createConfusionGroup, createLaw, deleteArticle, deleteConfusionGroup, deleteLaw, error, exportBackup, loadDemoData, loading, markRead, refresh, resetSystem, restoreBackup, saveImportedArticles, state, submitTraining, toggleTask, updateArticle, updateLaw, updateSettings])

  if (!value) return <div className="boot-screen"><div className="boot-mark">法典</div><p>{loading ? '正在開啟本機資料庫…' : error ?? '尚未準備好。'}</p><div className="boot-spinner" /></div>
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useAppData(): AppContextValue {
  const context = useContext(AppContext)
  if (!context) throw new Error('useAppData 必須在 AppProvider 內使用。')
  return context
}

function requireState(value: AppState | null): AppState {
  if (!value) throw new Error('本機資料尚未準備完成，請稍候再試。')
  return value
}

function toErrorMessage(value: unknown): string {
  if (value instanceof Error) return value.message
  return '本機資料操作失敗，請重新整理後再試。'
}

function updateProgress(progress: UserProgress, answer: AnswerRecord, timestamp: string): UserProgress {
  const date = todayKey()
  const dates = new Set(progress.studyDates)
  dates.add(date)
  const nextStreak = progress.lastStudyDate === date
    ? progress.streakDays
    : progress.lastStudyDate && dateDiffInDays(progress.lastStudyDate, date) === 1
      ? progress.streakDays + 1
      : 1
  const xp = answer.mode === 'dictation' || answer.mode === 'surprise' ? (answer.score >= 95 ? 45 : 25) : answer.mode === 'reading' ? 3 : 12
  const experience = progress.experience + xp
  return {
    ...progress,
    level: Math.floor(experience / 500) + 1,
    experience,
    streakDays: nextStreak,
    totalStudyDays: dates.size,
    totalAnswers: progress.totalAnswers + 1,
    combo: answer.mode === 'dictation' && answer.score >= 95 && answer.usedHints === 0 && !answer.comparison.highWeightError ? progress.combo + 1 : 0,
    lastStudyDate: date,
    studyDates: Array.from(dates).sort(),
    lastEarnedAt: timestamp,
  }
}

async function unlockAchievements(input: { current: AppState; nextProgress: UserProgress; answer: AnswerRecord; article: LawArticle; mastery: MasteryRecord }): Promise<Achievement[]> {
  const currentKeys = new Set(input.current.achievements.map((item) => item.key))
  const dictationCount = input.current.answers.filter((item) => item.mode === 'dictation').length + (input.answer.mode === 'dictation' ? 1 : 0)
  const perfect = input.answer.score >= 100
  const masteryCount = input.current.mastery.filter((item) => item.status === '已精通').length + (input.mastery.status === '已精通' ? 1 : 0)
  const shouldUnlock = new Set<string>(['first-article'])
  if (input.answer.mode === 'dictation') shouldUnlock.add('first-dictation')
  if (perfect) shouldUnlock.add('first-perfect')
  if (input.nextProgress.streakDays >= 3) shouldUnlock.add('streak-3')
  if (input.nextProgress.streakDays >= 7) shouldUnlock.add('streak-7')
  if (input.nextProgress.totalAnswers >= 100) shouldUnlock.add('answers-100')
  if (masteryCount >= 10) shouldUnlock.add('mastery-10')
  if (input.answer.mode === 'surprise') shouldUnlock.add('first-surprise')
  if (input.article.isBoss && input.answer.score >= 95) shouldUnlock.add('first-boss')
  const newlyUnlocked: Achievement[] = []
  for (const definition of ACHIEVEMENT_DEFINITIONS) {
    if (shouldUnlock.has(definition.key) && !currentKeys.has(definition.key)) {
      const achievement: Achievement = { id: makeId('achievement'), ...definition, unlockedAt: nowIso() }
      await put(STORE_NAMES.achievements, achievement)
      newlyUnlocked.push(achievement)
    }
  }
  void dictationCount
  return newlyUnlocked
}

async function clearAllStores(): Promise<void> {
  await Promise.all(Object.values(STORE_NAMES).map((storeName) => clearStore(storeName)))
}

async function mergeRecords<T extends { id: string }>(storeName: typeof STORE_NAMES[keyof typeof STORE_NAMES], existing: T[], incoming: T[], key: (item: T) => string): Promise<void> {
  const existingKeys = new Set(existing.map(key))
  const additions = incoming.filter((item) => !existingKeys.has(key(item)))
  await putMany(storeName, additions)
}
