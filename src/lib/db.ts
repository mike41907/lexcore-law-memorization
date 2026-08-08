import type {
  Achievement,
  AnswerRecord,
  AppSettings,
  ArticleSection,
  ConfusionGroup,
  DailyTask,
  ErrorRecord,
  LawArticle,
  LawCollection,
  MasteryRecord,
  KnowledgeMastery,
  KnowledgePoint,
  KnowledgeQuestion,
  KnowledgeReview,
  ReviewSchedule,
  StudySession,
  UserProgress,
} from '../types'

export const DB_NAME = 'lexcore-local'
export const DB_VERSION = 2

export const STORE_NAMES = {
  settings: 'settings',
  laws: 'laws',
  articles: 'articles',
  sections: 'sections',
  sessions: 'sessions',
  answers: 'answers',
  errors: 'errors',
  reviews: 'reviews',
  mastery: 'mastery',
  tasks: 'tasks',
  achievements: 'achievements',
  confusions: 'confusions',
  progress: 'progress',
  knowledgePoints: 'knowledgePoints',
  knowledgeQuestions: 'knowledgeQuestions',
  knowledgeMastery: 'knowledgeMastery',
  knowledgeReviews: 'knowledgeReviews',
} as const

export type StoreName = (typeof STORE_NAMES)[keyof typeof STORE_NAMES]

let dbPromise: Promise<IDBDatabase> | undefined

function createStore(database: IDBDatabase, name: string, indexes: Array<[string, string]> = []): void {
  const store = database.createObjectStore(name, { keyPath: 'id' })
  for (const [indexName, keyPath] of indexes) store.createIndex(indexName, keyPath, { unique: false })
}

export function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('此瀏覽器不支援 IndexedDB，請改用最新版 Chrome、Edge、Safari 或 Firefox。'))
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(STORE_NAMES.settings)) createStore(database, STORE_NAMES.settings)
      if (!database.objectStoreNames.contains(STORE_NAMES.laws)) createStore(database, STORE_NAMES.laws, [['name', 'name']])
      if (!database.objectStoreNames.contains(STORE_NAMES.articles)) createStore(database, STORE_NAMES.articles, [['lawId', 'lawId'], ['articleNumber', 'articleNumber']])
      if (!database.objectStoreNames.contains(STORE_NAMES.sections)) createStore(database, STORE_NAMES.sections, [['articleId', 'articleId']])
      if (!database.objectStoreNames.contains(STORE_NAMES.sessions)) createStore(database, STORE_NAMES.sessions, [['articleId', 'articleId'], ['createdAt', 'completedAt']])
      if (!database.objectStoreNames.contains(STORE_NAMES.answers)) createStore(database, STORE_NAMES.answers, [['articleId', 'articleId'], ['createdAt', 'createdAt']])
      if (!database.objectStoreNames.contains(STORE_NAMES.errors)) createStore(database, STORE_NAMES.errors, [['articleId', 'articleId'], ['createdAt', 'createdAt']])
      if (!database.objectStoreNames.contains(STORE_NAMES.reviews)) createStore(database, STORE_NAMES.reviews, [['articleId', 'articleId'], ['nextReviewAt', 'nextReviewAt']])
      if (!database.objectStoreNames.contains(STORE_NAMES.mastery)) createStore(database, STORE_NAMES.mastery, [['articleId', 'articleId']])
      if (!database.objectStoreNames.contains(STORE_NAMES.tasks)) createStore(database, STORE_NAMES.tasks, [['date', 'date'], ['articleId', 'articleId']])
      if (!database.objectStoreNames.contains(STORE_NAMES.achievements)) createStore(database, STORE_NAMES.achievements, [['key', 'key']])
      if (!database.objectStoreNames.contains(STORE_NAMES.confusions)) createStore(database, STORE_NAMES.confusions)
      if (!database.objectStoreNames.contains(STORE_NAMES.progress)) createStore(database, STORE_NAMES.progress)
      if (!database.objectStoreNames.contains(STORE_NAMES.knowledgePoints)) createStore(database, STORE_NAMES.knowledgePoints, [['articleId', 'articleId'], ['type', 'type']])
      if (!database.objectStoreNames.contains(STORE_NAMES.knowledgeQuestions)) createStore(database, STORE_NAMES.knowledgeQuestions, [['knowledgePointId', 'knowledgePointId'], ['articleId', 'articleId']])
      if (!database.objectStoreNames.contains(STORE_NAMES.knowledgeMastery)) createStore(database, STORE_NAMES.knowledgeMastery, [['knowledgePointId', 'knowledgePointId'], ['articleId', 'articleId']])
      if (!database.objectStoreNames.contains(STORE_NAMES.knowledgeReviews)) createStore(database, STORE_NAMES.knowledgeReviews, [['knowledgePointId', 'knowledgePointId'], ['articleId', 'articleId'], ['nextReviewAt', 'nextReviewAt']])
    }
    request.onsuccess = () => {
      const database = request.result
      database.onversionchange = () => database.close()
      resolve(database)
    }
    request.onerror = () => reject(request.error ?? new Error('無法開啟本機資料庫。'))
  })
  return dbPromise
}

export function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB 操作失敗。'))
  })
}

export async function getById<T>(storeName: StoreName, id: string): Promise<T | undefined> {
  const database = await openDatabase()
  const transaction = database.transaction(storeName, 'readonly')
  return idbRequest(transaction.objectStore(storeName).get(id))
}

export async function getAll<T>(storeName: StoreName): Promise<T[]> {
  const database = await openDatabase()
  const transaction = database.transaction(storeName, 'readonly')
  return idbRequest(transaction.objectStore(storeName).getAll())
}

export async function put<T extends { id: string }>(storeName: StoreName, value: T): Promise<void> {
  const database = await openDatabase()
  const transaction = database.transaction(storeName, 'readwrite')
  transaction.objectStore(storeName).put(value)
  await transactionDone(transaction)
}

export async function putMany<T extends { id: string }>(storeName: StoreName, values: T[]): Promise<void> {
  if (!values.length) return
  const database = await openDatabase()
  const transaction = database.transaction(storeName, 'readwrite')
  const store = transaction.objectStore(storeName)
  values.forEach((value) => store.put(value))
  await transactionDone(transaction)
}

export async function putLawImportBatch(input: { laws: LawCollection[]; articles: LawArticle[]; sections: ArticleSection[] }): Promise<void> {
  const database = await openDatabase()
  const transaction = database.transaction([STORE_NAMES.laws, STORE_NAMES.articles, STORE_NAMES.sections], 'readwrite')
  const lawStore = transaction.objectStore(STORE_NAMES.laws)
  const articleStore = transaction.objectStore(STORE_NAMES.articles)
  const sectionStore = transaction.objectStore(STORE_NAMES.sections)
  input.laws.forEach((law) => lawStore.put(law))
  input.articles.forEach((article) => articleStore.put(article))
  input.sections.forEach((section) => sectionStore.put(section))
  await transactionDone(transaction)
}

export async function remove(storeName: StoreName, id: string): Promise<void> {
  const database = await openDatabase()
  const transaction = database.transaction(storeName, 'readwrite')
  transaction.objectStore(storeName).delete(id)
  await transactionDone(transaction)
}

export async function clearStore(storeName: StoreName): Promise<void> {
  const database = await openDatabase()
  const transaction = database.transaction(storeName, 'readwrite')
  transaction.objectStore(storeName).clear()
  await transactionDone(transaction)
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('資料庫交易失敗。'))
    transaction.onabort = () => reject(transaction.error ?? new Error('資料庫交易被中止。'))
  })
}

export interface DatabaseSnapshot {
  settings: AppSettings[]
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
  progress: UserProgress[]
  knowledgePoints: KnowledgePoint[]
  knowledgeQuestions: KnowledgeQuestion[]
  knowledgeMastery: KnowledgeMastery[]
  knowledgeReviews: KnowledgeReview[]
}

export async function readSnapshot(): Promise<DatabaseSnapshot> {
  const [settings, laws, articles, sections, sessions, answers, errors, reviews, mastery, tasks, achievements, confusions, progress, knowledgePoints, knowledgeQuestions, knowledgeMastery, knowledgeReviews] = await Promise.all([
    getAll<AppSettings>(STORE_NAMES.settings),
    getAll<LawCollection>(STORE_NAMES.laws),
    getAll<LawArticle>(STORE_NAMES.articles),
    getAll<ArticleSection>(STORE_NAMES.sections),
    getAll<StudySession>(STORE_NAMES.sessions),
    getAll<AnswerRecord>(STORE_NAMES.answers),
    getAll<ErrorRecord>(STORE_NAMES.errors),
    getAll<ReviewSchedule>(STORE_NAMES.reviews),
    getAll<MasteryRecord>(STORE_NAMES.mastery),
    getAll<DailyTask>(STORE_NAMES.tasks),
    getAll<Achievement>(STORE_NAMES.achievements),
    getAll<ConfusionGroup>(STORE_NAMES.confusions),
    getAll<UserProgress>(STORE_NAMES.progress),
    getAll<KnowledgePoint>(STORE_NAMES.knowledgePoints),
    getAll<KnowledgeQuestion>(STORE_NAMES.knowledgeQuestions),
    getAll<KnowledgeMastery>(STORE_NAMES.knowledgeMastery),
    getAll<KnowledgeReview>(STORE_NAMES.knowledgeReviews),
  ])
  return { settings, laws, articles, sections, sessions, answers, errors, reviews, mastery, tasks, achievements, confusions, progress, knowledgePoints, knowledgeQuestions, knowledgeMastery, knowledgeReviews }
}
