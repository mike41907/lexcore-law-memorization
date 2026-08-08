import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAppData } from '../context/AppContext'

const navigation = [
  { to: '/dashboard', label: '今日任務', icon: '⌂' },
  { to: '/articles', label: '法條瀏覽', icon: '≡' },
  { to: '/training', label: '模擬測驗', icon: '✦' },
  { to: '/errors', label: '錯題中心', icon: '△' },
  { to: '/analytics', label: '學習分析', icon: '↗' },
  { to: '/achievements', label: '成就', icon: '♜' },
]

const utilityNavigation = [
  { to: '/settings', label: '設定', icon: '⚙' },
]

export function AppShell(): JSX.Element {
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const { progress, error, settings } = useAppData()
  useEffect(() => setMobileOpen(false), [location.pathname])
  useEffect(() => {
    const root = document.documentElement
    const applyTheme = () => {
      const resolved = settings.themeMode === 'system'
        ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
        : settings.themeMode
      root.dataset.theme = resolved
      root.dataset.themeChoice = settings.themeMode
    }
    applyTheme()
    if (settings.themeMode !== 'system') return undefined
    const media = window.matchMedia('(prefers-color-scheme: light)')
    media.addEventListener('change', applyTheme)
    return () => media.removeEventListener('change', applyTheme)
  }, [settings.themeMode])

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileOpen ? 'sidebar-open' : ''}`}>
        <div className="brand-block">
          <div className="brand-mark">法</div>
          <div>
            <p className="brand-name">法典</p>
            <p className="brand-subtitle">LEXCORE / 0.14.3</p>
          </div>
        </div>
        <div className="profile-strip">
          <div className="level-orb">{progress.level}</div>
          <div className="profile-copy"><strong>記憶訓練者</strong><span>Lv.{progress.level} · {progress.experience} XP</span></div>
          <span className="local-dot" title="資料僅儲存在本機" />
        </div>
        <nav className="side-nav" aria-label="主要導覽">
          <p className="nav-caption">作戰中心</p>
          {navigation.map((item) => <NavItem key={item.to} {...item} />)}
          <p className="nav-caption nav-caption-spaced">資料與設定</p>
          {utilityNavigation.map((item) => <NavItem key={item.to} {...item} />)}
        </nav>
        <div className="sidebar-footer"><span className="shield">▣</span><span>離線模式<br /><small>本機資料庫已啟用</small></span></div>
      </aside>
      {mobileOpen && <button className="mobile-scrim" aria-label="關閉選單" onClick={() => setMobileOpen(false)} />}
      <main className="main-shell">
        <header className="topbar">
          <button className="mobile-menu" aria-label="開啟導覽" onClick={() => setMobileOpen(true)}>☰</button>
          <div className="breadcrumb"><span>LEXCORE</span><b>/</b><strong>{titleForPath(location.pathname)}</strong></div>
          <div className="topbar-actions"><span className="offline-badge"><span /> 僅本機儲存</span><div className="streak-badge">✦ {progress.streakDays} 日連續</div></div>
        </header>
        {error && <div className="global-alert" role="alert">{error}<button onClick={() => window.location.reload()}>重新整理</button></div>}
        <div className="page-content"><Outlet /></div>
      </main>
    </div>
  )
}

function NavItem({ to, label, icon }: { to: string; label: string; icon: string }): JSX.Element {
  return <NavLink to={to} className={({ isActive }) => `side-link ${isActive ? 'active' : ''}`}><span className="side-icon">{icon}</span><span>{label}</span></NavLink>
}

function titleForPath(pathname: string): string {
  const found = [...navigation, ...utilityNavigation].find((item) => pathname.startsWith(item.to))
  return found?.label ?? '儀表板'
}
