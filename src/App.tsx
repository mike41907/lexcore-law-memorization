import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { DashboardPage } from './pages/DashboardPage'
import { TodayPage } from './pages/TodayPage'
import { LawsPage } from './pages/LawsPage'
import { ArticlesPage } from './pages/ArticlesPage'
import { TrainingPage } from './pages/TrainingPage'
import { ErrorsPage } from './pages/ErrorsPage'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { RecordsPage } from './pages/RecordsPage'
import { AchievementsPage } from './pages/AchievementsPage'
import { ConfusionsPage } from './pages/ConfusionsPage'
import { SettingsPage } from './pages/SettingsPage'
import { BackupPage } from './pages/BackupPage'
import { LawSystemsPage } from './pages/LawSystemsPage'

export default function App(): JSX.Element {
  return <Routes>
    <Route element={<AppShell />}>
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/today" element={<TodayPage />} />
      <Route path="/laws" element={<LawsPage />} />
      <Route path="/articles" element={<ArticlesPage />} />
      <Route path="/systems" element={<LawSystemsPage />} />
      <Route path="/systems/:lawId" element={<LawSystemsPage />} />
      <Route path="/training" element={<TrainingPage />} />
      <Route path="/training/:articleId" element={<TrainingPage />} />
      <Route path="/errors" element={<ErrorsPage />} />
      <Route path="/analytics" element={<AnalyticsPage />} />
      <Route path="/records" element={<RecordsPage />} />
      <Route path="/achievements" element={<AchievementsPage />} />
      <Route path="/confusions" element={<ConfusionsPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/backup" element={<BackupPage />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Route>
  </Routes>
}
