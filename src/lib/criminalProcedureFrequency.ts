import type { ArticleExamFrequency, ExamFrequencyTier, ExamFrequencyTopicReference, LawArticle, LawCollection } from '../types'
import { normalizeArticleNumber } from './importer'

export interface CriminalProcedureFrequencyTopic extends ExamFrequencyTopicReference {
  articleNumbers: string[]
}

export const CRIMINAL_PROCEDURE_FREQUENCY_SOURCE_ID = 'criminal-procedure-120' as const
export const CRIMINAL_PROCEDURE_LAW_CODE = 'C0010001'

const t = (rank: number, category: string, title: string, count: number, articleNumbers: string[] = []): CriminalProcedureFrequencyTopic => ({ rank, category, title, count, articleNumbers })

// User-provided exam-frequency table. Article mappings are intentionally conservative:
// cross-law, constitutional-interpretation and doctrine-only issues remain visible here
// without being forced onto an inaccurate Criminal Procedure Code article.
export const CRIMINAL_PROCEDURE_FREQUENCY_TOPICS: CriminalProcedureFrequencyTopic[] = [
  t(1, '強制處分', '附帶搜索', 49, ['130']),
  t(2, '法院檢被告', '法官迴避', 43, ['17', '18', '19', '20', '21', '22', '23', '24', '25', '26']),
  t(3, '訴訟條件', '告訴（告訴乃論／告訴不可分／告訴期間）', 41, ['232', '233', '234', '235', '236', '237', '238', '239']),
  t(4, '強制處分', '現行犯逮捕', 38, ['88', '92']),
  t(5, '法院檢被告', '管轄（土地／事物／牽連／指定移轉）', 38, ['4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16']),
  t(6, '強制處分', '令狀搜索', 37, ['128', '128-1']),
  t(7, '證據法', '自白任意性', 36, ['98', '156']),
  t(8, '證據法', '證人（具結／拒絕證言）', 33, ['176-1', '180', '181', '181-1', '182', '183', '185', '186', '187', '188', '189']),
  t(9, '辯護人', '強制（指定）辯護', 31, ['31', '31-1']),
  t(10, '強制處分', '逕行搜索', 29, ['131']),
  t(11, '強制處分', '強制採樣與鑑定留置（§203-1、§205-2）', 29, ['203', '203-1', '203-2', '203-3', '203-4', '205-1', '205-2', '205-3']),
  t(12, '審判', '訴之單一同一與變更追加', 26, ['265', '267', '300']),
  t(13, '強制處分', '同意搜索', 26, ['131-1']),
  t(14, '辯護人', '偵查中辯護人在場與陳述意見權', 26, ['245']),
  t(15, '偵查程序', '告知義務（§95）', 26, ['95']),
  t(16, '救濟', '再審（§420新事實新證據）', 25, ['420']),
  t(17, '強制處分', '羈押（原因與必要性）', 25, ['101', '101-1', '101-2']),
  t(18, '強制處分', '拘提（一般／逕行）', 24, ['75', '76']),
  t(19, '救濟', '上訴利益與上訴權', 24, ['344', '345', '346', '347']),
  t(20, '強制處分', '科技偵查（GPS／M化車）', 23, ['153-1', '153-2', '153-3', '153-4', '153-5', '153-6', '153-7', '153-8']),
  t(21, '證據法', '違法搜索扣押之證據能力', 23, ['158-4']),
  t(22, '證據法', '傳聞法則（原則與定義）', 22, ['159']),
  t(23, '救濟', '抗告與準抗告', 22, ['403', '404', '405', '406', '416']),
  t(24, '審判', '對質詰問權（釋582）', 21, ['97', '166', '169', '184']),
  t(25, '偵查程序', '偵查不公開', 21, ['245']),
  t(26, '救濟', '第三審（法律審／上訴理由）', 21, ['376', '377', '378', '379']),
  t(27, '強制處分', '延長／停止／撤銷羈押', 20, ['107', '108', '109', '110', '115', '116', '117']),
  t(28, '強制處分', '限制出境出海', 20, ['93-2', '93-3', '93-4', '93-5', '93-6']),
  t(29, '審判', '直接與言詞審理', 20, ['221', '222', '273', '288', '289']),
  t(30, '偵查程序', '訊問／詢問程序', 19, ['94', '95', '96', '97', '98', '99', '100', '245']),
  t(31, '偵查程序', '夜間詢問', 19, ['100-3']),
  t(32, '證據法', '鑑定證據能力', 19, ['197', '198', '199', '200', '201', '202', '203', '204', '205', '206', '207', '208']),
  t(33, '證據法', '傳聞例外§159-3', 19, ['159-3']),
  t(34, '訴訟條件', '送達', 18, ['55', '56', '57', '58', '59', '60', '61', '62']),
  t(35, '辯護人', '接見通信權及其限制', 18, ['34', '34-1']),
  t(36, '訴訟條件', '撤回告訴', 17, ['238']),
  t(37, '偵查程序', '緩起訴（要件／附條件／撤銷）', 17, ['253-1', '253-2', '253-3']),
  t(38, '強制處分', '通訊監察（核發要件／緊急監察／另案監察）', 17),
  t(39, '強制處分', '傳喚', 17, ['71', '71-1']),
  t(40, '證據法', '不正訊問', 15, ['98', '156', '158-2']),
  t(41, '強制處分', '特殊扣押（電磁紀錄／秘密特權）', 15, ['133', '133-1', '134', '135']),
  t(42, '證據法', '勘驗與相驗', 15, ['212', '213', '214', '215', '216', '217', '218', '219']),
  t(43, '簡易協商', '簡易程序', 15, ['449', '450', '451', '452', '453', '454', '455']),
  t(44, '基礎', '訴訟構造（彈劾／糾問、當事人進行vs職權進行）', 15, ['161', '163']),
  t(45, '證據法', '證據裁判主義與嚴格證明', 15, ['154', '155']),
  t(46, '辯護人', '選任辯護權', 14, ['27', '28', '29', '30']),
  t(47, '訴訟條件', '既判力與一事不再理', 14, ['302', '303']),
  t(48, '強制處分', '強制處分基本原則（法官保留、令狀原則）', 14, ['128', '128-1', '133-1']),
  t(49, '強制處分', '另案扣押', 14, ['137']),
  t(50, '偵查程序', '不起訴處分', 14, ['252', '253', '255', '260']),
  t(51, '自訴', '自訴要件與程序', 14, ['319', '320', '321', '322', '323', '324', '325', '326', '327', '328', '329', '330', '331', '332', '333', '334', '335', '336', '337', '338', '339', '340', '341', '342', '343']),
  t(52, '審判', '變更起訴法條（§300）', 14, ['300']),
  t(53, '證據法', '共同被告與共犯自白之調查與補強', 13, ['156', '166', '169']),
  t(54, '辯護人', '辯護人閱卷權', 13, ['33', '33-1']),
  t(55, '證據法', '被害人陳述', 13, ['248-1', '271', '271-1']),
  t(56, '強制處分', '一般扣押', 13, ['133', '133-1', '133-2']),
  t(57, '證據法', '證據排除法則（§158-4權衡）', 13, ['158-4']),
  t(58, '強制處分', '羈押審查與卷證獲知（釋737）', 13, ['33-1', '93', '101']),
  t(59, '偵查程序', '准許提起自訴（原交付審判）', 13, ['258-1', '258-2', '258-3', '258-4']),
  t(60, '證據法', '供述與非供述證據', 13, ['156', '159', '164', '165', '165-1']),
  t(61, '訴訟條件', '訴訟行為與要式性', 12, ['39', '40', '41', '42', '43', '44', '45', '46', '47', '48', '49', '50', '51', '52', '53', '54']),
  t(62, '審判', '交互詰問（主詰問／反詰問／覆主詰問、誘導界限）', 12, ['166', '166-1', '166-2', '166-3', '166-4', '166-5', '166-6', '166-7', '167']),
  t(63, '審判', '準備程序與爭點整理', 12, ['273', '273-1', '273-2']),
  t(64, '偵查程序', '再議', 11, ['256', '257', '258']),
  t(65, '辯護人', '輔佐人與代理人', 11, ['35', '36', '37', '38']),
  t(66, '證據法', '舉證責任', 11, ['161']),
  t(67, '審判', '沒收特別程序', 11, ['455-12', '455-13', '455-14', '455-15', '455-16', '455-17', '455-18', '455-19', '455-20', '455-21', '455-22', '455-23', '455-24', '455-25', '455-26', '455-27', '455-28', '455-29', '455-30', '455-31', '455-32', '455-33', '455-34', '455-35', '455-36', '455-37']),
  t(68, '救濟', '非常上訴（統一法令／判決違背法令）', 11, ['441', '442', '443', '444', '445', '446', '447', '448']),
  t(69, '強制處分', '誘捕偵查（陷害教唆vs釣魚）', 11),
  t(70, '偵查程序', '起訴（法定／便宜原則）', 11, ['251', '253']),
  t(71, '強制處分', '緊急拘捕（§88-1）', 10, ['88-1']),
  t(72, '強制處分', '逮捕後處置與時限', 10, ['89', '90', '91', '92', '93', '93-1']),
  t(73, '簡易協商', '認罪協商程序', 10, ['455-2', '455-3', '455-4', '455-5', '455-6', '455-7', '455-8', '455-9', '455-10', '455-11']),
  t(74, '強制處分', '緊急搜索', 10, ['131']),
  t(75, '證據法', '傳聞例外§159-2', 9, ['159-2']),
  t(76, '偵查程序', '全程連續錄音錄影', 9, ['100-1', '100-2']),
  t(77, '訴訟條件', '期間與回復原狀', 9, ['64', '65', '66', '67', '68', '69', '70']),
  t(78, '強制處分', '對第三人搜索', 8, ['122']),
  t(79, '強制處分', '通緝', 8, ['84', '85', '86', '87']),
  t(80, '簡易協商', '簡式審判程序', 8, ['273-1', '273-2']),
  t(81, '審判', '無罪推定', 8, ['154']),
  t(82, '訴訟條件', '訴訟條件總論', 8),
  t(83, '救濟', '第二審構造', 8, ['361', '362', '363', '364', '365', '366', '367', '368', '369', '370', '371', '372', '373', '374']),
  t(84, '證據法', '傳聞例外§159-1', 7, ['159-1']),
  t(85, '證據法', '毒樹果實', 7, ['158-4']),
  t(86, '證據法', '自白補強法則', 7, ['156']),
  t(87, '自訴', '公訴與自訴之關係', 7, ['323']),
  t(88, '法院檢被告', '被告地位與緘默權', 7, ['95', '156']),
  t(89, '其他', '其他—被害人訴訟參與', 7, ['455-38', '455-39', '455-40', '455-41', '455-42', '455-43', '455-44', '455-45', '455-46', '455-47']),
  t(90, '其他', '其他—暫行安置', 6, ['121-1', '121-2', '121-3', '121-4']),
  t(91, '救濟', '不利益變更禁止', 6, ['370']),
  t(92, '證據法', '傳聞例外§159-4', 5, ['159-4']),
  t(93, '強制處分', '預防性羈押', 5, ['101-1']),
  t(94, '證據法', '不自證己罪', 5, ['95', '156', '181']),
  t(95, '證據法', '私人不法取證', 5, ['158-4']),
  t(96, '審判', '起訴審查（§161）', 4, ['161']),
  t(97, '證據法', '傳聞例外§159-5', 4, ['159-5']),
  t(98, '證據法', '自由心證', 4, ['155']),
  t(99, '證據法', '正當法律程序', 4, ['158-4']),
  t(100, '其他', '其他—國民法官法', 4),
  t(101, '訴訟條件', '告發與請求', 4, ['240', '241']),
  t(102, '自訴', '自訴強制律師代理', 3, ['319']),
  t(103, '法院檢被告', '檢察官客觀性義務與檢察一體', 3),
  t(104, '強制處分', '具保責付限制住居', 3, ['101-2', '110', '111', '112', '113', '114', '115', '116', '117']),
  t(105, '自訴', '自訴不可分', 2, ['319', '343']),
  t(106, '強制處分', '調取票與通聯', 2),
  t(107, '其他', '其他—檢警關係', 2, ['229', '230', '231']),
  t(108, '其他', '其他—證據保全', 2, ['219-1', '219-2', '219-3', '219-4', '219-5', '219-6', '219-7', '219-8']),
  t(109, '證據法', '比例原則', 1, ['90', '122', '132', '158-4']),
  t(110, '其他', '其他—審判組織（獨任與合議）', 1),
  t(111, '其他', '其他—保全證據', 1, ['219-1', '219-2', '219-3', '219-4', '219-5', '219-6', '219-7', '219-8']),
  t(112, '辯護人', '有效辯護與辯護權侵害之效果', 1, ['27', '31', '31-1']),
  t(113, '其他', '其他—被告之確定（冒名頂替）', 1, ['94']),
  t(114, '其他', '其他—通譯', 1, ['99', '211']),
  t(115, '其他', '其他—審判筆錄', 1, ['44', '45', '46', '47', '48']),
  t(116, '其他', '其他—法定法官原則', 1),
  t(117, '其他', '其他—控制下交付', 1),
  t(118, '其他', '其他—偵查總論（司法警察調查）', 1, ['228', '229', '230', '231']),
  t(119, '其他', '其他—指認程序', 1),
  t(120, '其他', '其他—卷證資訊獲知權', 1, ['33', '33-1']),
]

export function examFrequencyTier(rank: number): ExamFrequencyTier {
  if (rank <= 15) return 'S'
  if (rank <= 40) return 'A'
  if (rank <= 75) return 'B'
  return 'C'
}

export function isCriminalProcedureLaw(law: LawCollection | undefined): boolean {
  if (!law) return false
  if (law.source?.lawCode === CRIMINAL_PROCEDURE_LAW_CODE) return true
  return normalizeLawName(law.name) === '刑事訴訟法' || normalizeLawName(law.shortName) === '刑事訴訟法'
}

export function buildCriminalProcedureArticleFrequency(): Map<string, ArticleExamFrequency> {
  const result = new Map<string, ArticleExamFrequency>()
  for (const topic of CRIMINAL_PROCEDURE_FREQUENCY_TOPICS) {
    for (const rawNumber of topic.articleNumbers) {
      const articleNumber = normalizeArticleNumber(rawNumber)
      const current = result.get(articleNumber)
      const reference: ExamFrequencyTopicReference = { rank: topic.rank, category: topic.category, title: topic.title, count: topic.count }
      result.set(articleNumber, {
        sourceId: CRIMINAL_PROCEDURE_FREQUENCY_SOURCE_ID,
        bestRank: Math.min(current?.bestRank ?? topic.rank, topic.rank),
        totalCount: (current?.totalCount ?? 0) + topic.count,
        tier: examFrequencyTier(Math.min(current?.bestRank ?? topic.rank, topic.rank)),
        topics: [...(current?.topics ?? []), reference].sort((left, right) => left.rank - right.rank),
      })
    }
  }
  return result
}

export function applyCriminalProcedureFrequency(laws: LawCollection[], articles: LawArticle[]): { articles: LawArticle[]; changed: LawArticle[] } {
  const criminalLawIds = new Set(laws.filter(isCriminalProcedureLaw).map((law) => law.id))
  if (!criminalLawIds.size) return { articles, changed: [] }
  const frequencyMap = buildCriminalProcedureArticleFrequency()
  const changed: LawArticle[] = []
  const enriched = articles.map((article) => {
    if (!criminalLawIds.has(article.lawId)) return article
    const examFrequency = frequencyMap.get(normalizeArticleNumber(article.articleNumber))
    if (!examFrequency) return article
    const importance = Math.max(article.importance, examFrequency.tier === 'S' || examFrequency.tier === 'A' ? 5 : examFrequency.tier === 'B' ? 4 : 3) as LawArticle['importance']
    const next: LawArticle = {
      ...article,
      examFrequency,
      importance,
      mustMemorize: article.mustMemorize || examFrequency.tier === 'S' || examFrequency.tier === 'A',
      includeDaily: true,
      isBoss: article.isBoss || examFrequency.tier === 'S',
    }
    if (sameEnrichment(article, next)) return article
    changed.push(next)
    return next
  })
  return { articles: enriched, changed }
}

export function compareExamFrequency(left: LawArticle, right: LawArticle): number {
  const leftRank = left.examFrequency?.bestRank ?? Number.POSITIVE_INFINITY
  const rightRank = right.examFrequency?.bestRank ?? Number.POSITIVE_INFINITY
  return leftRank - rightRank
    || (right.examFrequency?.totalCount ?? 0) - (left.examFrequency?.totalCount ?? 0)
}

export function examFrequencyScore(article: LawArticle): number {
  const frequency = article.examFrequency
  if (!frequency) return 0
  const tierWeight: Record<ExamFrequencyTier, number> = { S: 400, A: 300, B: 200, C: 100 }
  return tierWeight[frequency.tier] + Math.max(0, 121 - frequency.bestRank) * 2 + Math.min(150, frequency.totalCount)
}

function sameEnrichment(left: LawArticle, right: LawArticle): boolean {
  return left.importance === right.importance
    && left.mustMemorize === right.mustMemorize
    && left.includeDaily === right.includeDaily
    && left.isBoss === right.isBoss
    && JSON.stringify(left.examFrequency) === JSON.stringify(right.examFrequency)
}

function normalizeLawName(value: string): string {
  return value.trim().replace(/^中華民國/, '').replace(/[\s　]/g, '')
}
