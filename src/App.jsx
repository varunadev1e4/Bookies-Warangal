import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import Layout from './components/Layout'
import AuthPage from './pages/AuthPage'
import HomePage from './pages/HomePage'
import LibraryPage from './pages/LibraryPage'
import MeetupsPage from './pages/MeetupsPage'
import LeaderboardPage from './pages/LeaderboardPage'
import ProfilePage from './pages/ProfilePage'
import AdminPage from './pages/AdminPage'
import NotificationsPage from './pages/NotificationsPage'
import MembersPage from './pages/MembersPage'
import SuggestionsPage from './pages/SuggestionsPage'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return (
    <div className="loading-screen">
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 32, color: 'var(--amber)' }}>📚</div>
      <div className="spinner" />
    </div>
  )
  if (!user) return <Navigate to="/auth" replace />
  return children
}

function AdminRoute({ children }) {
  const { isAdmin, loading } = useAuth()
  if (loading) return null
  if (!isAdmin) return <Navigate to="/" replace />
  return children
}

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) return (
    <div className="loading-screen">
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 38, marginBottom: 6, color: 'var(--amber)' }}>📚</div>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, fontWeight: 700, marginBottom: 16 }}>Bookies India</div>
      <div className="spinner" />
    </div>
  )

  return (
    <Routes>
      <Route path="/auth" element={user ? <Navigate to="/" replace /> : <AuthPage />} />

      <Route path="/*" element={
        <ProtectedRoute>
          <Layout>
            <Routes>
              <Route path="/"           element={<HomePage />}      />
              <Route path="/library"    element={<LibraryPage />}   />
              <Route path="/meetups"    element={<MeetupsPage />}   />
              <Route path="/leaderboard" element={<LeaderboardPage />} />
              <Route path="/profile"    element={<ProfilePage />}   />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/members" element={<MembersPage />} />
              <Route path="/suggestions" element={<SuggestionsPage />} />
              <Route path="/admin"      element={
                <AdminRoute><AdminPage /></AdminRoute>
              } />
              <Route path="*"           element={<Navigate to="/" replace />} />
            </Routes>
          </Layout>
        </ProtectedRoute>
      } />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}