import { useState } from 'react'
import { BrowserRouter, Routes, Route, Link, NavLink, Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AuthProvider, useAuth } from './context/AuthContext'
import HomePage from './pages/HomePage'
import TournamentPage from './pages/TournamentPage'
import PlayerPage from './pages/PlayerPage'
import RulesPage from './pages/RulesPage'
import LoginPage from './pages/LoginPage'
import AdminPage from './pages/AdminPage'
import { setLanguage } from './i18n'

function RequireAdmin({ children }) {
  const { admin, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex justify-center items-center h-40">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }
  if (!admin) return <Navigate to="/login" replace />
  return children
}

function Nav() {
  const { admin, logout } = useAuth()
  const { t, i18n } = useTranslation()
  const [mobileOpen, setMobileOpen] = useState(false)
  const currentLng = i18n.language === 'fi' ? 'fi' : 'en'
  const close = () => setMobileOpen(false)
  return (
    <nav className="bg-gray-900 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center py-3">
          <Link to="/" className="text-xl font-bold" onClick={close}>{t('app.title')}</Link>

          <button
            onClick={() => setMobileOpen((o) => !o)}
            className="md:hidden p-2 -mr-2 text-gray-300 hover:text-white focus:outline-none"
            aria-label={mobileOpen ? t('app.closeMenu') : t('app.openMenu')}
          >
            {mobileOpen ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="6" y1="6" x2="18" y2="18" />
                <line x1="18" y1="6" x2="6" y2="18" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            )}
          </button>

          <div className="hidden md:flex items-center space-x-4">
            <NavLink to="/" className="hover:text-gray-300">{t('app.home')}</NavLink>
            <NavLink to="/players" className="hover:text-gray-300">{t('app.performance')}</NavLink>
            <NavLink to="/rules" className="hover:text-gray-300">{t('app.rules')}</NavLink>
            <span className="text-gray-400 text-sm">•</span>
            <button
              onClick={() => setLanguage(currentLng === 'fi' ? 'en' : 'fi')}
              className="px-2 py-1 bg-gray-700 rounded hover:bg-gray-600 text-sm"
            >
              {currentLng === 'fi' ? 'EN' : 'FI'}
            </button>
            {admin ? (
              <>
                <NavLink to="/admin" className="hover:text-gray-300">{t('app.adminPanel')}</NavLink>
                <span className="text-gray-300 text-sm">{admin.username}</span>
                <button onClick={logout} className="px-3 py-1 bg-red-600 rounded hover:bg-red-700 text-sm">
                  {t('app.logout')}
                </button>
              </>
            ) : (
              <NavLink to="/login" className="px-3 py-1 bg-blue-600 rounded hover:bg-blue-700 text-sm">
                {t('app.adminLogin')}
              </NavLink>
            )}
          </div>
        </div>

        {mobileOpen && (
          <div className="md:hidden pb-4 flex flex-col space-y-2">
            <NavLink to="/" className="px-3 py-2 rounded hover:bg-gray-800" onClick={close}>{t('app.home')}</NavLink>
            <NavLink to="/players" className="px-3 py-2 rounded hover:bg-gray-800" onClick={close}>{t('app.performance')}</NavLink>
            <NavLink to="/rules" className="px-3 py-2 rounded hover:bg-gray-800" onClick={close}>{t('app.rules')}</NavLink>
            <button
              onClick={() => setLanguage(currentLng === 'fi' ? 'en' : 'fi')}
              className="px-3 py-2 rounded bg-gray-700 hover:bg-gray-600 text-sm text-left"
            >
              {currentLng === 'fi' ? 'EN' : 'FI'}
            </button>
            {admin ? (
              <>
                <NavLink to="/admin" className="px-3 py-2 rounded hover:bg-gray-800" onClick={close}>{t('app.adminPanel')}</NavLink>
                <span className="px-3 py-2 text-gray-400 text-sm">{admin.username}</span>
                <button
                  onClick={() => { close(); logout() }}
                  className="px-3 py-2 bg-red-600 rounded hover:bg-red-700 text-sm text-left"
                >
                  {t('app.logout')}
                </button>
              </>
            ) : (
              <NavLink
                to="/login"
                className="px-3 py-2 bg-blue-600 rounded hover:bg-blue-700 text-sm text-left"
                onClick={close}
              >
                {t('app.adminLogin')}
              </NavLink>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}

function AppRoutes() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Nav />
      <div className="max-w-7xl mx-auto px-4 py-6">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/tournament/:id" element={<TournamentPage />} />
          <Route path="/players" element={<PlayerPage />} />
          <Route path="/rules" element={<RulesPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/admin"
            element={
              <RequireAdmin>
                <AdminPage />
              </RequireAdmin>
            }
          />
        </Routes>
      </div>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App