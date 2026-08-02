import { Link, useNavigate } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { Button, EmptyState, Notice, PageHeader, ProgressBar, StatusBadge } from '../components/ui'
import { useAppData } from '../context/AppContext'
import { estimateExamCompletion } from '../lib/mastery'
import { daysUntil, formatDateTW, formatDateTimeTW, todayKey } from '../lib/utils'

export function DashboardPage(): JSX.Element {
  const data = useAppData()
  const navigate = useNavigate()
  const [message, setMessage] = useState('')
  const activeLaws = data.laws.filter((law) => !law.deletedAt)
  const activeArticles = data.articles.filter((article) => !article.deletedAt && data.laws.some((law) => law.id === article.lawId && !law.deletedAt))
  const masteryMap = useMemo(() => new Map(data.mastery.map((item) => [item.articleId, item])), [data.mastery])
  const todayTasks = data.tasks.filter((task) => task.date === todayKey())
  const completedTasks = todayTasks.filter((task) => task.completed).length
  const dueCount = data.reviews.filter((review) => new Date(review.nextReviewAt).getTime() <= Date.now()).length
  const highRisk = data.mastery.filter((item) => item.status === '高風險' || item.status === '需要重新學習').length
  const mastered = data.mastery.filter((item) => item.status === '已精通').length
  const overallMastery = activeArticles.length ? data.mastery.filter((item) => activeArticles.some((article) => article.id === item.articleId)).reduce((sum, item) => sum + item.score, 0) / activeArticles.length : 0
  const lastThirtyAnswers = data.answers.filter((answer) => Date.now() - new Date(answer.createdAt).getTime() <= 30 * 86_400_000)
  const lastThirtyAccuracy = lastThirtyAnswers.length ? lastThirtyAnswers.reduce((sum, answer) => sum + answer.score, 0) / lastThirtyAnswers.length : 0
  const examDays = daysUntil(data.settings.examDate)
  const forecast = estimateExamCompletion(activeArticles, data.mastery, data.settings.dailyStudyMinutes, Math.max(examDays, 0))
  const recentAnswers = [...data.answers].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5)
  const weeklyCounts = Array.from({ length: 7 }, (_, index) => {
    const date = new Date()
    date.setDate(date.getDate() - (6 - index))
    const key = todayKey(date)
    return { key, count: data.answers.filter((answer) => todayKey(new Date(answer.createdAt)) === key).length, label: `${date.getMonth() + 1}/${date.getDate()}` }
  })

  async function addDemo(): Promise<void> {
    try {
      await data.loadDemoData()
      setMessage('已加入示範資料；內容均標示為非正式法條。')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '載入示範資料失敗。')
    }
  }

  return <div className="page-stack">
    <PageHeader eyebrow="LEXCORE / 作戰中心" title="今日學習總覽" description={`${formatDateTW(todayKey())} · 所有資料只儲存在這台裝置`} actions={<Button onClick={() => navigate('/today')}>開始今日訓練 <span>→</span></Button>} />
    {message && <Notice tone="success">{message}</Notice>}
    {!activeArticles.length && <Notice tone="warning"><strong>尚未匯入正式法條。</strong> 請先建立法規並匯入你已校對的法條原文。{!activeLaws.length && <span> 也可以先 <button className="inline-action" onClick={addDemo}>載入示範資料</button> 驗證操作流程。</span>}</Notice>}
    <section className="hero-grid">
      <div className="exam-card card-glow">
        <div className="hero-topline"><span className="eyebrow">距離目標考試</span><span className="hero-icon">◈</span></div>
        <div className="exam-days">{examDays >= 0 ? examDays : 0}<small>天</small></div>
        <p>預定考試日　<strong>{formatDateTW(data.settings.examDate)}</strong></p>
        <ProgressBar value={forecast.currentRate} label="目前精熟完成率" tone="gold" />
        <div className="hero-foot"><span>依目前紀錄推估</span><strong>{Math.round(forecast.forecastRate)}% 考前完成率</strong></div>
      </div>
      <div className="today-card card">
        <div className="card-heading"><div><p className="eyebrow">TODAY / 任務隊列</p><h2>今日任務</h2></div><Link className="text-link" to="/today">查看全部 →</Link></div>
        <div className="task-ring-row"><div className="task-ring" style={{ '--ring-value': `${todayTasks.length ? (completedTasks / todayTasks.length) * 100 : 0}%` } as React.CSSProperties}><strong>{completedTasks}</strong><span>/{todayTasks.length}</span></div><div><p className="big-inline">完成率 <strong>{todayTasks.length ? Math.round((completedTasks / todayTasks.length) * 100) : 0}%</strong></p><p className="muted">預估 {todayTasks.reduce((sum, task) => sum + task.estimatedMinutes, 0)} 分鐘 · {dueCount} 條到期</p></div></div>
        <Button variant="secondary" className="full-width" onClick={() => navigate('/today')}>進入今日任務</Button>
      </div>
    </section>

    <section className="stats-grid">
      <Stat label="法規 / 法條" value={`${activeLaws.length} / ${activeArticles.length}`} detail="已匯入資料" icon="⌘" />
      <Stat label="已精通" value={String(mastered)} detail={`共 ${activeArticles.length} 條`} icon="◆" tone="gold" />
      <Stat label="待複習" value={String(dueCount)} detail="現在到期" icon="◷" tone="blue" />
      <Stat label="高風險" value={String(highRisk)} detail="需要優先處理" icon="△" tone="red" />
      <Stat label="總答題次數" value={String(data.progress.totalAnswers)} detail={`Lv.${data.progress.level} · ${data.progress.experience} XP`} icon="✦" tone="purple" />
      <Stat label="近 30 日正確率" value={`${Math.round(lastThirtyAccuracy)}%`} detail={`${lastThirtyAnswers.length} 次作答`} icon="↗" tone="green" />
    </section>

    <section className="two-column-grid">
      <div className="card chart-card"><div className="card-heading"><div><p className="eyebrow">ACTIVITY / 近七日</p><h2>學習量</h2></div><span className="muted">答題次數</span></div><div className="bar-chart">{weeklyCounts.map((item) => <div className="bar-column" key={item.key}><span className="bar-value">{item.count || ''}</span><div className="bar-track"><span style={{ height: `${Math.max(5, Math.min(100, item.count * 18))}%` }} /></div><small>{item.label}</small></div>)}</div></div>
      <div className="card"><div className="card-heading"><div><p className="eyebrow">LAW MAP / 法規進度</p><h2>各法規熟練度</h2></div><Link className="text-link" to="/analytics">分析 →</Link></div>{activeLaws.length ? <div className="law-progress-list">{activeLaws.slice(0, 4).map((law) => { const lawArticles = activeArticles.filter((article) => article.lawId === law.id); const average = lawArticles.length ? lawArticles.reduce((sum, article) => sum + (masteryMap.get(article.id)?.score ?? 0), 0) / lawArticles.length : 0; return <div className="law-progress-row" key={law.id}><div className="law-row-title"><span>{law.shortName || law.name}</span><strong>{Math.round(average)}%</strong></div><ProgressBar value={average} showValue={false} tone={average >= 80 ? 'green' : 'blue'} /></div> })}</div> : <EmptyState icon="⌘" title="尚無法規" description="建立一部法規後，這裡會顯示進度地圖。" action={<Link className="button button-secondary" to="/laws">建立法規</Link>} />}</div>
    </section>

    <section className="two-column-grid bottom-grid"><div className="card"><div className="card-heading"><div><p className="eyebrow">RECENT / 最近紀錄</p><h2>訓練動態</h2></div><Link className="text-link" to="/records">全部紀錄 →</Link></div>{recentAnswers.length ? <div className="activity-list">{recentAnswers.map((answer) => { const article = data.articles.find((item) => item.id === answer.articleId); const law = data.laws.find((item) => item.id === answer.lawId); return <div className="activity-row" key={answer.id}><div className="activity-dot" /><div className="activity-copy"><strong>{law?.shortName ?? '未知法規'} · 第 {article?.articleNumber ?? '?'} 條</strong><span>{formatDateTimeTW(answer.createdAt)}</span></div><strong className={`score-text ${answer.score >= 90 ? 'positive' : 'negative'}`}>{Math.round(answer.score)} 分</strong></div> })}</div> : <EmptyState icon="◷" title="還沒有訓練紀錄" description="完成一次默寫後，紀錄會顯示在這裡。" action={<Button variant="secondary" onClick={() => navigate(activeArticles.length ? `/training/${activeArticles[0].id}` : '/laws')}>{activeArticles.length ? '開始第一次訓練' : '先建立法規'}</Button>} />}</div><div className="card forecast-card"><div className="card-heading"><div><p className="eyebrow">FORECAST / 考試進度</p><h2>目前預測</h2></div><span className={`forecast-pill ${forecast.behind ? 'behind' : ''}`}>{forecast.behind ? '需要加速' : '穩定推進'}</span></div><div className="forecast-main"><strong>{Math.round(forecast.forecastRate)}%</strong><span>依目前紀錄推估的考前完成率</span></div><div className="forecast-lines"><div><span>建議每日新法條</span><strong>{forecast.recommendedNew} 條</strong></div><div><span>建議每日複習量</span><strong>{forecast.recommendedReview} 條</strong></div><div><span>目前整體熟練度</span><strong>{Math.round(overallMastery)}%</strong></div></div><Notice tone="info">這是依目前學習紀錄的推估，不是結果保證。</Notice></div></section>
  </div>
}

function Stat({ label, value, detail, icon, tone = 'blue' }: { label: string; value: string; detail: string; icon: string; tone?: string }): JSX.Element {
  return <div className={`stat-card stat-${tone}`}><div className="stat-icon">{icon}</div><div><p>{label}</p><strong>{value}</strong><span>{detail}</span></div></div>
}
