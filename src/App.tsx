import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './features/onboarding/AuthProvider'
import { BracketPage } from './features/bracket/BracketPage'
import { LeaderboardPage } from './features/leaderboard/LeaderboardPage'
import { LivePage } from './features/live/LivePage'
import { PrizesPage } from './features/prizes/PrizesPage'
import { AdminApp } from './routes/admin/AdminApp'
import { PhoneApp } from './routes/PhoneApp'
import { TvDisplay } from './routes/tv/TvDisplay'

export function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<PhoneApp />}>
            <Route index element={<Navigate to="live" replace />} />
            <Route path="live" element={<LivePage />} />
            <Route path="leaderboard" element={<LeaderboardPage />} />
            <Route path="prizes" element={<PrizesPage />} />
            <Route path="bracket" element={<BracketPage />} />
          </Route>
          <Route path="/tv" element={<TvDisplay />} />
          <Route path="/admin/*" element={<AdminApp />} />
          <Route path="*" element={<Navigate to="/live" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
