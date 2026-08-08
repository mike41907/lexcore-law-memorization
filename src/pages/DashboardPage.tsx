import { Link, useNavigate } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { Button, EmptyState, Notice, PageHeader, ProgressBar, StatusBadge } from '../components/ui'
import { useAppData } from '../context/AppContext'
import { estimateExamCompletion } from '../lib/mastery'
import { EXAM_SUBJECTS, classifyExamSubject } from '../lib/examSubjects'
import { daysUntil, formatDateTW, formatDateTimeTW, todayKey } from '../lib/utils'

export function DashboardPage(): JSX.Element {
  const data = useAppData()
  const navigate = useNavigate()
  const [message, setMessage] = useState('')
  const activeLaws = data.laws.filter((law) => !law.deletedAt)
  const activeArticles = data.articles.filter((article) => !article.deletedAt && activeLaws.some((law) => law.id === article.lawId))
  const masteryMap = useMemo(() => new Map(data.mastery.map((item) => [item.articleId, item])), [data.mastery])
  const todayTasks = data.tasks.filter((task) => task.date === todayKey())
  const completedTasks = todayTasks.filter((task) => task.completed).length
  const dueArticleIds = useMemo(() => new Set(data.reviews.filter((review) => new Date(review.nextReviewAt).getTime() <= Date.now()).map((review) => review.articleId)), [data.reviews])
  const dueCount = dueArticleIds.size
  const highRisk = data.mastery.filter((item) => item.status === '高風險' || item.status === '需要重新學習').length
  const mastered = data.mastery.filter((item) => item.status === '已精通').length
  const overallMastery = activeArticles.length ? activeArticles.reduce((sum, article) => sum + (masteryMap.get(article.id)?.score ?? 0), 0) / activeArticles.length : 0
  const lastThirtyAnswers = data.answers.filter((answer) => Date.now() - new Date(answer.createdAt).getTime() <= 30 * 86_400_000)
  const lastThirtyAccuracy = lastThirtyAnswers.length ? lastThirtyAnswers.reduce((sum, answer) => sum + answer.score, 0) / lastThirtyAnswers.length : 0
  const examDays = daysUntil(data.settings.examDate)
  const forecast = estimateExamCompletion(activeArticles, data.mastery, data.settings.dailyStudyMinutes, Math.max(examDays, 0))
  const recentAnswers = [...data.answers].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5)
  const todayMinutes = todayTasks.reduce((sum, task) => sum + task.estimatedMinutes, 0)
  const todayNewCount = todayTasks.filter((task) => task.type === 'new').length
  const todayBoss = todayTasks.map((task) => data.articles.find((article) => article.id === task.articleId)).find((article) => article?.isBoss || (article && (masteryMap.get(article.id)?.score ?? 0) < 50))
  const subjectStats = EXAM_SUBJECTS.map((subject) => {
    const laws = activeLaws.filter((law) => (law.examSubject ?? classifyExamSubject(law)) === subject.id)
    const articles = activeArticles.filter((article) => laws.some((law) => law.id === article.lawId))
    const scores = articles.map((article) => masteryMap.get(article.id)?.score ?? 0)
    return { subject, laws, articles, learned: scores.filter((score) => score > 0).length, mastered: scores.filter((score) => score >= 90).length, due: articles.filter((article) => dueArticleIds.has(article.id)).length, highRisk: articles.filter((article) => ['高風險', '需要重新學習'].includes(masteryMap.get(article.id)?.status ?? '')).length, average: scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0 }
  })
  const weeklyCounts = Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() - (6 - index))
    const key = todayKey(date)
    return { key, count: data.answers.filter((answer) => todayKey(new Date(answer.createdAt)) === key).length, label: `${date.getMonth() + 1}/${date.getDate()}` }
  })

  async function addDemo(): Promise<void> {
    try { await data.loadDemoData(); setMessage('已加入示範資料；內容均標示為非正式法條。') } catch (error) { setMessage(error instanceof Error ? error.message : '載入示範資料失敗。') }
  }

  return <div className="page-stack dashboard-page">
    <PageHeader eyebrow="LEXCORE / TODAY COMMAND CENTER" title="今天，先把最重要的法條拿下" description={`${formatDateTW(todayKey())} · 你的學習資料只儲存在這台裝置`} actions={<Button className="command-button" onClick={() => navigate('/today')}>開始今日任務 <span>→</span></Button>} />
    {message && <Notice tone="success">{message}</Notice>}
    {!activeArticles.length && <Notice tone="warning"><strong>尚未匯入正式法條。</strong> 請先到法條瀏覽建立考科資料。{!activeLaws.length && <span> 也可以先 <button className="inline-action" onClick={addDemo}>載入示範資料</button> 驗證操作流程。</span>}</Notice>}

    <section className="dashboard-hero-grid">
      <div className="dashboard-countdown card-glow"><div className="dashboard-kicker"><span className="eyebrow">EXAM COUNTDOWN</span><span className="dashboard-live-dot">本機學習中</span></div><div className="dashboard-countdown-value">{examDays >= 0 ? examDays : 0}<small>天</small></div><p>距離考試 <strong>{formatDateTW(data.settings.examDate)}</strong></p><ProgressBar value={forecast.currentRate} label="目前精熟完成率" tone="gold" /><div className="dashboard-countdown-foot"><span>考前預估完成率</span><strong>{Math.round(forecast.forecastRate)}%</strong></div></div>
      <div className="dashboard-today-card card"><div className="card-heading"><div><p className="eyebrow">TODAY / 今日隊列</p><h2>今天有 {todayTasks.length} 個任務</h2></div><Link className="text-link" to="/today">查看全部 →</Link></div><div className="today-progress-line"><div className="today-progress-ring" style={{ '--ring-value': `${todayTasks.length ? (completedTasks / todayTasks.length) * 100 : 0}%` } as React.CSSProperties}><strong>{completedTasks}</strong><span>/{todayTasks.length}</span></div><div><p className="dashboard-big-stat">{todayTasks.length ? Math.round((completedTasks / todayTasks.length) * 100) : 0}<small>%</small></p><p className="muted">已完成今日任務</p><p className="dashboard-time">預估 {todayMinutes} 分鐘 · 新法條 {todayNewCount} 條</p></div></div><Button variant="secondary" className="full-width" onClick={() => navigate('/today')}>進入今日任務</Button></div>
    </section>

    <section className="dashboard-metric-grid"><DashboardMetric label="待複習" value={dueCount} detail="現在到期" tone="blue" icon="↻" /><DashboardMetric label="高風險法條" value={highRisk} detail="需要優先處理" tone="red" icon="!" /><DashboardMetric label="今日學習時間" value={`${todayMinutes}m`} detail={`目標 ${data.settings.dailyStudyMinutes} 分鐘`} tone="gold" icon="◷" /><DashboardMetric label="連續學習" value={data.progress.streakDays} detail="日不中斷" tone="green" icon="✦" /><DashboardMetric label="已精通" value={mastered} detail={`共 ${activeArticles.length} 條`} tone="purple" icon="◆" /><DashboardMetric label="近 30 日正確率" value={`${Math.round(lastThirtyAccuracy)}%`} detail={`${lastThirtyAnswers.length} 次作答`} tone="blue" icon="↗" /></section>

    <section className="dashboard-section-heading"><div><p className="eyebrow">FIVE SUBJECTS / 五大考科</p><h2>你的法條地圖</h2><p className="muted-text">先從整體熟練度判斷今天該往哪一科深入。</p></div><Link className="text-link" to="/articles">開啟法條瀏覽 →</Link></section>
    <section className="dashboard-subject-grid">{subjectStats.map(({ subject, laws, articles, learned, mastered: subjectMastered, due, highRisk: subjectRisk, average }) => <Link className="dashboard-subject-card card" to={`/articles?subject=${subject.id}`} key={subject.id}><div className="dashboard-subject-top"><span className="subject-monogram">{subject.shortLabel.slice(0, 1)}</span><span className={`mastery-dot ${masteryTone(average)}`} /> <span className="dashboard-subject-label">{subject.label}</span><strong>{Math.round(average)}%</strong></div><ProgressBar value={average} showValue={false} tone={average >= 90 ? 'green' : average >= 70 ? 'gold' : 'blue'} /><div className="dashboard-subject-stats"><span>{laws.length} 部法規</span><span>{articles.length} 條</span><span>已學 {learned}</span><span>精通 {subjectMastered}</span><span>待複習 {due}</span><span>高風險 {subjectRisk}</span></div></Link>)}</section>

    <section className="dashboard-focus-grid"><div className="dashboard-focus-card card"><div className="card-heading"><div><p className="eyebrow">BOSS ARTICLE / 今日魔王</p><h2>{todayBoss ? `第 ${todayBoss.articleNumber} 條` : '今天沒有指定魔王法條'}</h2></div><span className="focus-mark">⌁</span></div>{todayBoss ? <><p className="focus-law-name">{activeLaws.find((law) => law.id === todayBoss.lawId)?.shortName ?? '法條'} · {todayBoss.title || '高難度條文'}</p><p className="focus-preview">{todayBoss.text.slice(0, 150)}{todayBoss.text.length > 150 ? '…' : ''}</p><div className="focus-actions"><StatusBadge status={masteryMap.get(todayBoss.id)?.status ?? '未開始'} /><Button variant="secondary" onClick={() => navigate(`/training/${todayBoss.id}`)}>挑戰魔王</Button></div></> : <EmptyState icon="✦" title="繼續保持" description="標記為魔王或高風險的法條會在這裡出現。" />}</div><div className="dashboard-focus-card card"><div className="card-heading"><div><p className="eyebrow">RECENT / 最近學習</p><h2>你剛剛讀過的法條</h2></div><Link className="text-link" to="/records">全部紀錄 →</Link></div>{recentAnswers.length ? <div className="dashboard-recent-list">{recentAnswers.map((answer) => { const article = data.articles.find((item) => item.id === answer.articleId); const law = data.laws.find((item) => item.id === answer.lawId); return <button type="button" className="dashboard-recent-row" key={answer.id} onClick={() => article && navigate(`/articles?law=${article.lawId}`)}><span className="recent-row-dot" /><span><strong>{law?.shortName ?? '未知法規'} · 第 {article?.articleNumber ?? '?'} 條</strong><small>{formatDateTimeTW(answer.createdAt)}</small></span><b>{Math.round(answer.score)}</b></button> })}</div> : <EmptyState icon="◷" title="還沒有學習紀錄" description="完成第一個今日任務後，紀錄會顯示在這裡。" />}</div></section>

    <section className="dashboard-bottom-grid"><div className="card chart-card"><div className="card-heading"><div><p className="eyebrow">ACTIVITY / 近七日</p><h2>學習量</h2></div><span className="muted">答題次數</span></div><div className="bar-chart">{weeklyCounts.map((item) => <div className="bar-column" key={item.key}><span className="bar-value">{item.count || ''}</span><div className="bar-track"><span style={{ height: `${Math.max(5, Math.min(100, item.count * 18))}%` }} /></div><small>{item.label}</small></div>)}</div></div><div className="card forecast-card"><div className="card-heading"><div><p className="eyebrow">FORECAST / 考試進度</p><h2>目前節奏</h2></div><span className={`forecast-pill ${forecast.behind ? 'behind' : ''}`}>{forecast.behind ? '需要加速' : '穩定推進'}</span></div><div className="forecast-main"><strong>{Math.round(forecast.forecastRate)}%</strong><span>依目前紀錄推估的考前完成率</span></div><div className="forecast-lines"><div><span>建議每日新法條</span><strong>{forecast.recommendedNew} 條</strong></div><div><span>建議每日複習量</span><strong>{forecast.recommendedReview} 條</strong></div><div><span>目前整體熟練度</span><strong>{Math.round(overallMastery)}%</strong></div></div><Link className="button button-ghost full-width" to="/analytics">查看學習分析</Link></div></section>
  </div>
}

function DashboardMetric({ label, value, detail, tone, icon }: { label: string; value: number | string; detail: string; tone: string; icon: string }): JSX.Element {
  return <div className={`dashboard-metric card metric-${tone}`}><span className="dashboard-metric-icon">{icon}</span><div><p>{label}</p><strong>{value}</strong><small>{detail}</small></div></div>
}

function masteryTone(score: number): string {
  return score >= 90 ? 'tone-green' : score >= 70 ? 'tone-yellow' : 'tone-red'
}
