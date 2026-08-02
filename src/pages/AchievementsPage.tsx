import { useNavigate } from 'react-router-dom'
import { Button, EmptyState, PageHeader } from '../components/ui'
import { useAppData } from '../context/AppContext'
import { ACHIEVEMENT_DEFINITIONS } from '../types'
import { formatDateTW } from '../lib/utils'

export function AchievementsPage(): JSX.Element {
  const data = useAppData()
  const navigate = useNavigate()
  const unlocked = new Map(data.achievements.map((item) => [item.key, item]))
  return <div className="page-stack"><PageHeader eyebrow="ACHIEVEMENTS / PROGRESSION" title="成就系統" description="成就只反映學習行為，不會改寫熟練度；完整默寫與跨日穩定複習會提供較高 XP。" actions={<Button variant="secondary" onClick={() => navigate('/training')}>繼續訓練 →</Button>} /><section className="achievement-hero card"><div className="achievement-emblem">♜</div><div><p className="eyebrow">TRAINER LEVEL</p><h2>Lv.{data.progress.level} 記憶訓練者</h2><p>累積 {data.progress.experience} XP · 連續學習 {data.progress.streakDays} 天 · 已解鎖 {data.achievements.length} 項成就</p></div><div className="xp-progress"><ProgressLine value={(data.progress.experience % 500) / 5} /><span>{data.progress.experience % 500} / 500 XP 至下一級</span></div></section><div className="achievement-grid">{ACHIEVEMENT_DEFINITIONS.map((definition) => { const item = unlocked.get(definition.key); return <article className={`achievement-card card ${item ? 'unlocked' : ''}`} key={definition.key}><div className="achievement-icon">{item ? '◆' : '◇'}</div><div><h3>{definition.title}</h3><p>{definition.description}</p>{item ? <span className="achievement-date">已於 {formatDateTW(item.unlockedAt)} 解鎖</span> : <span className="achievement-locked">尚未解鎖</span>}</div></article> })}</div>{!data.achievements.length && <EmptyState icon="♜" title="第一項成就正在等你" description="完成一次訓練就會解鎖「初次落筆」。" action={<Button onClick={() => navigate('/training')}>開始第一次訓練</Button>} />}</div>
}

function ProgressLine({ value }: { value: number }): JSX.Element { return <div className="xp-line"><span style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div> }
