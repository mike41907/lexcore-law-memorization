import { useEffect, useState } from 'react'
import { Button, Notice, PageHeader } from '../components/ui'
import { useAppData } from '../context/AppContext'

export function SettingsPage(): JSX.Element {
  const data = useAppData()
  const [examDate, setExamDate] = useState(data.settings.examDate)
  const [dailyMinutes, setDailyMinutes] = useState(String(data.settings.dailyStudyMinutes))
  const [newArticles, setNewArticles] = useState(String(data.settings.dailyNewArticles))
  const [reviewLimit, setReviewLimit] = useState(String(data.settings.dailyReviewLimit))
  const [fontScale, setFontScale] = useState(String(data.settings.fontScale))
  const [keywords, setKeywords] = useState(data.settings.highWeightKeywords.join('、'))
  const [intervals, setIntervals] = useState(data.settings.reviewIntervals.join(', '))
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  useEffect(() => { setExamDate(data.settings.examDate); setDailyMinutes(String(data.settings.dailyStudyMinutes)); setNewArticles(String(data.settings.dailyNewArticles)); setReviewLimit(String(data.settings.dailyReviewLimit)); setFontScale(String(data.settings.fontScale)); setKeywords(data.settings.highWeightKeywords.join('、')); setIntervals(data.settings.reviewIntervals.join(', ')) }, [data.settings])

  async function save(): Promise<void> {
    setError(''); setMessage('')
    const parsedIntervals = intervals.split(/[,，]/).map(Number).filter((value) => Number.isFinite(value) && value > 0)
    if (!examDate || parsedIntervals.length < 3) { setError('請填入有效考試日期，且至少保留三個複習間隔。'); return }
    try { await data.updateSettings({ examDate, dailyStudyMinutes: clampNumber(dailyMinutes, 5, 240), dailyNewArticles: clampNumber(newArticles, 1, 50), dailyReviewLimit: clampNumber(reviewLimit, 1, 100), fontScale: clampNumber(fontScale, 0.85, 1.35), highWeightKeywords: keywords.split(/[、,，\n]/).map((item) => item.trim()).filter(Boolean), reviewIntervals: parsedIntervals, compare: { ...data.settings.compare } }); setMessage('設定已儲存，之後的訓練與任務會使用新設定。') } catch (caught) { setError(caught instanceof Error ? caught.message : '設定儲存失敗。') }
  }

  async function reset(): Promise<void> {
    const confirmation = window.prompt('重置會清除本機法規、法條、作答、錯題與遊戲進度。若確定，請輸入：重置 LexCore')
    if (confirmation !== '重置 LexCore') { if (confirmation !== null) setError('確認文字不正確，未執行重置。'); return }
    try { await data.resetSystem(); setMessage('系統已重置；所有本機資料已清除。') } catch (caught) { setError(caught instanceof Error ? caught.message : '重置失敗。') }
  }

  return <div className="page-stack"><PageHeader eyebrow="SETTINGS / CONTROL" title="系統設定" description="設定只儲存在本機。考試日期與訓練參數會影響儀表板預測、每日任務與排程。" />{message && <Notice tone="success">{message}</Notice>}{error && <Notice tone="warning">{error}</Notice>}<div className="settings-layout"><section className="settings-main card"><div className="settings-section"><div className="settings-section-heading"><span>01</span><div><h2>學習目標</h2><p>用於考試倒數與每日任務容量估算。</p></div></div><div className="form-grid"><label>考試日期<input type="date" value={examDate} onChange={(event) => setExamDate(event.target.value)} /></label><label>每日學習分鐘<input type="number" min="5" max="240" value={dailyMinutes} onChange={(event) => setDailyMinutes(event.target.value)} /></label><label>每日新法條數<input type="number" min="1" max="50" value={newArticles} onChange={(event) => setNewArticles(event.target.value)} /></label><label>每日最大複習量<input type="number" min="1" max="100" value={reviewLimit} onChange={(event) => setReviewLimit(event.target.value)} /></label></div></div><div className="settings-section"><div className="settings-section-heading"><span>02</span><div><h2>文字比對</h2><p>原始法條不會被修改；這些選項只影響比對結果。</p></div></div><div className="toggle-list"><Toggle label="忽略標點符號" checked={data.settings.compare.ignorePunctuation} onChange={(value) => void data.updateSettings({ compare: { ...data.settings.compare, ignorePunctuation: value } })} /><Toggle label="忽略空白" checked={data.settings.compare.ignoreWhitespace} onChange={(value) => void data.updateSettings({ compare: { ...data.settings.compare, ignoreWhitespace: value } })} /><Toggle label="忽略換行差異" checked={data.settings.compare.ignoreLineBreaks} onChange={(value) => void data.updateSettings({ compare: { ...data.settings.compare, ignoreLineBreaks: value } })} /><Toggle label="忽略全形／半形差異" checked={data.settings.compare.ignoreFullHalf} onChange={(value) => void data.updateSettings({ compare: { ...data.settings.compare, ignoreFullHalf: value } })} /><Toggle label="嚴格比對法定用語" checked={data.settings.compare.strictLegalTerms} onChange={(value) => void data.updateSettings({ compare: { ...data.settings.compare, strictLegalTerms: value } })} /><Toggle label="嚴格比對項、款、目順序" checked={data.settings.compare.strictStructure} onChange={(value) => void data.updateSettings({ compare: { ...data.settings.compare, strictStructure: value } })} /></div><label>高權重關鍵詞（以頓號或逗號分隔）<textarea value={keywords} onChange={(event) => setKeywords(event.target.value)} rows={3} /></label></div><div className="settings-section"><div className="settings-section-heading"><span>03</span><div><h2>複習與介面</h2><p>間隔以天為單位；0.007 天約等於 10 分鐘。</p></div></div><div className="form-grid"><label>間隔複習天數<input value={intervals} onChange={(event) => setIntervals(event.target.value)} /></label><label>介面字級<input type="number" step="0.05" min="0.85" max="1.35" value={fontScale} onChange={(event) => setFontScale(event.target.value)} /></label></div><div className="toggle-list"><Toggle label="優先安排必背法條" checked={data.settings.includeMandatoryFirst} onChange={(value) => void data.updateSettings({ includeMandatoryFirst: value })} /><Toggle label="啟用突擊抽考任務" checked={data.settings.enableSurprise} onChange={(value) => void data.updateSettings({ enableSurprise: value })} /><Toggle label="啟用短動畫" checked={data.settings.animationsEnabled} onChange={(value) => void data.updateSettings({ animationsEnabled: value })} /></div></div><div className="settings-save-row"><span className="muted">最後修改：{new Date(data.settings.updatedAt).toLocaleString('zh-TW')}</span><Button onClick={() => void save()}>儲存設定</Button></div></section><aside className="settings-side"><div className="card privacy-card"><span className="privacy-icon">▣</span><h2>本機資料邊界</h2><p>法條、答案、錯題與備份都不會自動上傳。第一版不使用雲端 AI、分析追蹤或外部 API。</p><div className="privacy-line"><span /> IndexedDB 已啟用</div><div className="privacy-line"><span /> 無登入／無註冊</div><div className="privacy-line"><span /> 可離線使用</div></div><div className="card danger-card"><p className="eyebrow">DANGER ZONE</p><h2>重置本機系統</h2><p>清除所有本機資料且無法從瀏覽器復原。若有重要資料，請先在備份與還原頁匯出 JSON。</p><Button variant="danger" onClick={() => void reset()}>重置 LexCore</Button></div></aside></div></div>
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }): JSX.Element { return <label className="toggle-row"><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><i /></label> }

function clampNumber(value: string, min: number, max: number): number { const parsed = Number(value); return Math.min(max, Math.max(min, Number.isFinite(parsed) ? parsed : min)) }
