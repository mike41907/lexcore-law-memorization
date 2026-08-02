import type { LawArticle, LawCollection } from '../types'
import { makeId, nowIso } from './utils'

export interface DemoData {
  law: LawCollection
  articles: LawArticle[]
}

export function createDemoData(now = nowIso()): DemoData {
  const lawId = makeId('law')
  const articleOne = makeId('article')
  const articleTwo = makeId('article')
  const disclaimer = '示範資料，非正式法條內容。請以正式法規來源校對後再匯入。'
  return {
    law: {
      id: lawId,
      name: '法條訓練示範集',
      shortName: '示範集',
      category: '示範資料',
      importance: 3,
      examScope: false,
      notes: disclaimer,
      createdAt: now,
      updatedAt: now,
    },
    articles: [
      {
        id: articleOne,
        lawId,
        articleNumber: '1',
        title: '示範條文一',
        text: `${disclaimer} 本條用於測試完整默寫、逐字比對與間隔複習流程。`,
        notes: disclaimer,
        importance: 3,
        mustMemorize: true,
        includeDaily: true,
        tags: ['示範', '比對'],
        isBoss: false,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: articleTwo,
        lawId,
        articleNumber: '2',
        title: '示範條文二',
        text: `${disclaimer} 本條用於測試錯字、漏字、多字與高權重詞彙提示。`,
        notes: disclaimer,
        importance: 4,
        mustMemorize: false,
        includeDaily: true,
        tags: ['示範', '錯題'],
        isBoss: true,
        createdAt: now,
        updatedAt: now,
      },
    ],
  }
}
