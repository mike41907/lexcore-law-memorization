import { useEffect, useMemo, useRef, useState } from 'react'
import type { ImportArticleDraft, LawArticle, LawCollection } from '../types'
import {
  createOfficialImportDrafts,
  fetchOfficialLawDetail,
  fetchOfficialLawIndex,
  normalizeOfficialArticleNumber,
  searchOfficialLaws,
  type OfficialLawDataSource,
  type OfficialLawDetail,
  type OfficialLawIndex,
  type OfficialLawSummary,
} from '../lib/officialLaws'
import { Button, Notice } from './ui'

const RESULT_LIMIT = 50
const ARTICLE_PAGE_SIZE = 100

interface OfficialLawImporterProps {
  localLaws: LawCollection[]
  localArticles: LawArticle[]
  onPrepare: (law: OfficialLawSummary, source: OfficialLawDataSource, drafts: ImportArticleDraft[]) => Promise<void>
}

export function OfficialLawImporter({ localLaws, localArticles, onPrepare }: OfficialLawImporterProps): JSX.Element {
  const [index, setIndex] = useState<OfficialLawIndex | null>(null)
  const [indexError, setIndexError] = useState('')
  const [loadingIndex, setLoadingIndex] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)
  const [query, setQuery] = useState('')
  const [includeRepealed, setIncludeRepealed] = useState(false)
  const [selectedLaw, setSelectedLaw] = useState<OfficialLawSummary | null>(null)
  const [detail, setDetail] = useState<OfficialLawDetail | null>(null)
  const [detailError, setDetailError] = useState('')
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [articleQuery, setArticleQuery] = useState('')
  const [visibleLimit, setVisibleLimit] = useState(ARTICLE_PAGE_SIZE)
  const [selectedNumbers, setSelectedNumbers] = useState<Set<string>>(new Set())
  const [preparing, setPreparing] = useState(false)
  const [actionError, setActionError] = useState('')
  const requestSequence = useRef(0)

  useEffect(() => {
    let active = true
    setLoadingIndex(true)
    setIndexError('')
    void fetchOfficialLawIndex()
      .then((payload) => { if (active) setIndex(payload) })
      .catch((caught) => { if (active) setIndexError(caught instanceof Error ? caught.message : '官方法規索引讀取失敗。') })
      .finally(() => { if (active) setLoadingIndex(false) })
    return () => { active = false }
  }, [reloadKey])

  const searchResults = useMemo(
    () => searchOfficialLaws(index?.laws ?? [], query, includeRepealed, RESULT_LIMIT + 1),
    [includeRepealed, index, query],
  )
  const displayedResults = searchResults.slice(0, RESULT_LIMIT)
  const currentLawCount = index?.laws.filter((law) => law.status === 'current').length ?? 0
  const matchingLocalLaw = useMemo(() => {
    if (!selectedLaw) return undefined
    return localLaws.find((law) => !law.deletedAt && (
      law.source?.lawCode === selectedLaw.code
      || normalizeName(law.name) === normalizeName(selectedLaw.name)
    ))
  }, [localLaws, selectedLaw])
  const existingNumbers = useMemo(() => new Set(
    matchingLocalLaw
      ? localArticles
        .filter((article) => article.lawId === matchingLocalLaw.id && !article.deletedAt)
        .map((article) => normalizeOfficialArticleNumber(article.articleNumber))
      : [],
  ), [localArticles, matchingLocalLaw])
  const filteredArticles = useMemo(() => {
    const needle = normalizeName(articleQuery)
    if (!detail) return []
    if (!needle) return detail.articles
    return detail.articles.filter((article) => normalizeName(`${article.number}${article.heading}${article.content}`).includes(needle))
  }, [articleQuery, detail])
  const visibleArticles = filteredArticles.slice(0, visibleLimit)
  const selectedAvailableCount = Array.from(selectedNumbers).filter((number) => !existingNumbers.has(number)).length

  async function chooseLaw(law: OfficialLawSummary): Promise<void> {
    const requestId = ++requestSequence.current
    setSelectedLaw(law)
    setDetail(null)
    setDetailError('')
    setActionError('')
    setArticleQuery('')
    setVisibleLimit(ARTICLE_PAGE_SIZE)
    setSelectedNumbers(new Set())
    setLoadingDetail(true)
    try {
      const loaded = await fetchOfficialLawDetail(law)
      if (requestId === requestSequence.current) setDetail(loaded)
    } catch (caught) {
      if (requestId === requestSequence.current) setDetailError(caught instanceof Error ? caught.message : '官方條文讀取失敗。')
    } finally {
      if (requestId === requestSequence.current) setLoadingDetail(false)
    }
  }

  function toggleArticle(number: string): void {
    const key = normalizeOfficialArticleNumber(number)
    if (existingNumbers.has(key)) return
    setSelectedNumbers((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function selectVisibleArticles(): void {
    setSelectedNumbers((current) => {
      const next = new Set(current)
      for (const article of visibleArticles) {
        const number = normalizeOfficialArticleNumber(article.number)
        if (!existingNumbers.has(number)) next.add(number)
      }
      return next
    })
  }

  async function preparePreview(): Promise<void> {
    if (!index || !selectedLaw || !detail) return
    const available = Array.from(selectedNumbers).filter((number) => !existingNumbers.has(number))
    if (!available.length) {
      setActionError('請至少勾選一條尚未匯入的法條。')
      return
    }
    setPreparing(true)
    setActionError('')
    try {
      const drafts = createOfficialImportDrafts(index.source, selectedLaw, detail, available)
      await onPrepare(selectedLaw, index.source, drafts)
      setSelectedNumbers(new Set())
    } catch (caught) {
      setActionError(caught instanceof Error ? caught.message : '建立官方法條預覽失敗。')
    } finally {
      setPreparing(false)
    }
  }

  return <div className="official-importer">
    <Notice tone="info">
      線上搜尋資料由法務部「全國法規資料庫」提供；勾選後仍會先進入 LexCore 預覽，不會直接覆寫本機法條。
    </Notice>

    {loadingIndex && <div className="official-loading" role="status"><span />正在載入官方法規索引…</div>}
    {indexError && <Notice tone="warning"><div>{indexError}</div><Button variant="ghost" onClick={() => setReloadKey((value) => value + 1)}>重新載入</Button></Notice>}

    {index && <>
      <div className="official-source-strip">
        <div><span>資料來源</span><strong>{index.source.provider} · {index.source.systemName}</strong></div>
        <div><span>官方資料更新</span><strong>{formatDate(index.source.dataUpdatedAt)}</strong></div>
        <div><span>收錄範圍</span><strong>{currentLawCount.toLocaleString('zh-TW')} 部現行法律</strong></div>
        <a href={index.source.datasetUrl} target="_blank" rel="noreferrer">查看政府資料集 ↗</a>
      </div>

      <div className="official-search-panel">
        <label className="official-main-search">
          <span>搜尋法規名稱、類別或法規代碼</span>
          <div><b>⌕</b><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="例如：刑法、民法、行政程序法" autoComplete="off" /></div>
        </label>
        <label className="checkbox-row official-repealed-toggle"><input type="checkbox" checked={includeRepealed} onChange={(event) => setIncludeRepealed(event.target.checked)} /> 包含廢止法規</label>
      </div>
      <div className="official-quick-search" aria-label="快速搜尋">
        <span>快速搜尋</span>
        {['中華民國刑法', '民法', '行政程序法', '刑事訴訟法'].map((term) => <button key={term} onClick={() => setQuery(term)}>{term}</button>)}
      </div>

      {query.trim() && <div className="official-results" aria-live="polite">
        <div className="official-results-heading"><strong>搜尋結果</strong><span>{searchResults.length > RESULT_LIMIT ? `${RESULT_LIMIT}+` : searchResults.length} 部</span></div>
        {displayedResults.length ? displayedResults.map((law) => <button type="button" className={`official-law-result ${selectedLaw?.code === law.code ? 'selected' : ''}`} key={law.code} onClick={() => void chooseLaw(law)}>
          <span className="official-law-result-main"><strong>{law.name}</strong><small>{law.category || law.level} · {law.code}</small></span>
          <span className="official-law-result-meta"><b>{law.articleCount.toLocaleString('zh-TW')} 條</b>{law.status === 'repealed' && <em>已廢止</em>}<i>選擇</i></span>
        </button>) : <div className="official-no-result">找不到符合條件的法規，請改用較短的關鍵字。</div>}
        {searchResults.length > RESULT_LIMIT && <p className="official-result-hint">結果超過 {RESULT_LIMIT} 部，請再加上關鍵字縮小範圍。</p>}
      </div>}

      {selectedLaw && <section className="official-law-detail" aria-busy={loadingDetail}>
        <div className="official-detail-heading">
          <div><p className="eyebrow">SELECT ARTICLES / 選擇條文</p><h3>{selectedLaw.name}</h3><p>{selectedLaw.category} · 最近異動 {formatCompactDate(selectedLaw.modifiedDate)}</p></div>
          <a href={selectedLaw.url} target="_blank" rel="noreferrer">在官方網站核對 ↗</a>
        </div>
        {selectedLaw.status === 'repealed' && <Notice tone="warning">這部法規已標示為廢止。請先確認這確實是你要背誦的版本。</Notice>}
        {loadingDetail && <div className="official-loading" role="status"><span />正在載入 {selectedLaw.articleCount.toLocaleString('zh-TW')} 條條文…</div>}
        {detailError && <Notice tone="warning"><div>{detailError}</div><Button variant="ghost" onClick={() => void chooseLaw(selectedLaw)}>重試</Button></Notice>}
        {detail && <>
          <div className="official-article-toolbar">
            <label className="search-box"><span>⌕</span><input value={articleQuery} onChange={(event) => { setArticleQuery(event.target.value); setVisibleLimit(ARTICLE_PAGE_SIZE) }} placeholder="搜尋條號或條文內容" /></label>
            <div><Button variant="ghost" onClick={selectVisibleArticles}>勾選目前顯示</Button><Button variant="ghost" onClick={() => setSelectedNumbers(new Set())}>清除勾選</Button></div>
          </div>
          <div className="official-selection-summary"><span>符合 {filteredArticles.length.toLocaleString('zh-TW')} 條</span><strong>已選 {selectedAvailableCount.toLocaleString('zh-TW')} 條</strong>{matchingLocalLaw && <span>本機「{matchingLocalLaw.name}」已有 {existingNumbers.size.toLocaleString('zh-TW')} 條</span>}</div>
          <div className="official-article-list">
            {visibleArticles.map((article, index) => {
              const number = normalizeOfficialArticleNumber(article.number)
              const exists = existingNumbers.has(number)
              return <label className={`official-article-option ${exists ? 'already-imported' : ''}`} key={`${number}-${index}`}>
                <input type="checkbox" checked={!exists && selectedNumbers.has(number)} disabled={exists} onChange={() => toggleArticle(number)} />
                <span className="official-article-number">第 {number} 條</span>
                <span className="official-article-copy">{article.heading && <small>{article.heading}</small>}<span>{article.content}</span></span>
                {exists && <em>已匯入</em>}
              </label>
            })}
          </div>
          {visibleArticles.length < filteredArticles.length && <Button variant="ghost" className="official-more" onClick={() => setVisibleLimit((value) => value + ARTICLE_PAGE_SIZE)}>再顯示 {Math.min(ARTICLE_PAGE_SIZE, filteredArticles.length - visibleArticles.length)} 條</Button>}
          {actionError && <Notice tone="warning">{actionError}</Notice>}
          <div className="official-import-footer"><p>選取的條文只會放入下方預覽；按「確認並儲存」後才寫入本機 IndexedDB。</p><Button disabled={preparing || selectedAvailableCount === 0} onClick={() => void preparePreview()}>{preparing ? '正在建立預覽…' : `將 ${selectedAvailableCount} 條加入預覽`}</Button></div>
        </>}
      </section>}
    </>}
  </div>
}

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase('zh-Hant').replace(/[\s　]/g, '')
}

function formatDate(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  return match ? `${match[1]}/${Number(match[2])}/${Number(match[3])}` : value
}

function formatCompactDate(value: string): string {
  const match = value.match(/^(\d{4})(\d{2})(\d{2})$/)
  return match ? `${match[1]}/${Number(match[2])}/${Number(match[3])}` : value || '未提供'
}
