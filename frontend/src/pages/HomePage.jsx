import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { tournamentService } from '../services/api'
import { useAuth } from '../context/AuthContext'

function CreateTournamentModal({ onClose, onCreated }) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      await tournamentService.create({ name, password })
      onCreated()
    } catch (err) {
      alert(`${t('home.errorCreate')} ${err.response?.data?.error || err.message}`)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">{t('home.createTitle')}</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('home.name')}</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('home.adminPassword')} <span className="text-xs text-gray-500">{t('home.passwordHint')}</span>
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              {t('home.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ChangeTournamentPasswordModal({ tournament, onClose, onChanged }) {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError(t('admin.passwordsMismatch'))
      return
    }
    try {
      await tournamentService.changePassword(tournament.id, password)
      // This browser may hold a token issued for the old password; the backend
      // rejects it now, so clear it and let the unlock prompt ask again.
      localStorage.removeItem(`tournament_token_${tournament.id}`)
      onChanged()
    } catch (err) {
      setError(err.response?.data?.error || t('home.errorChangePassword'))
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-1">{t('home.changePasswordTitle')}</h2>
        <p className="text-sm text-gray-500 mb-4">
          {tournament.name} — {t('home.changePasswordHint')}
        </p>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('home.newTournamentPassword')}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('admin.confirmPassword')}
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              {t('admin.updatePassword')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function TournamentCard({ tournament, onChangePassword }) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const getStatusBadge = (status) => {
    const colors = {
      'setup': 'bg-yellow-100 text-yellow-800',
      'round_robin': 'bg-blue-100 text-blue-800',
      'playoffs': 'bg-purple-100 text-purple-800',
      'completed': 'bg-green-100 text-green-800'
    }
    const labels = {
      'setup': t('home.statusSetup'),
      'round_robin': t('home.statusRoundRobin'),
      'playoffs': t('home.statusPlayoffs'),
      'completed': t('home.statusCompleted')
    }
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
        {labels[status] || status.replace('_', ' ').toUpperCase()}
      </span>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-5">
        <div className="flex flex-wrap justify-between items-start gap-2 mb-2">
          <h3 className="text-lg font-bold text-gray-900">{tournament.name}</h3>
          {getStatusBadge(tournament.status)}
        </div>
        <p className="text-sm text-gray-500 mb-4">
          {t('home.created')} {new Date(tournament.created_at).toLocaleDateString()}
        </p>
        <button
          onClick={() => navigate(`/tournament/${tournament.id}`)}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          {t('home.open')}
        </button>
        {onChangePassword && (
          <button
            onClick={onChangePassword}
            className="w-full mt-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
          >
            {t('home.changeTournamentPassword')}
          </button>
        )}
      </div>
    </div>
  )
}

function HomePage() {
  const { t } = useTranslation()
  const { admin } = useAuth()
  const [tournaments, setTournaments] = useState([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [passwordTarget, setPasswordTarget] = useState(null)
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchTournaments = async () => {
    try {
      const response = await tournamentService.getAll()
      setTournaments(response.data)
    } catch (err) {
      console.error('Error fetching tournaments:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTournaments()
  }, [])

  const handleTournamentCreated = () => {
    setShowCreateModal(false)
    fetchTournaments()
  }

  const handlePasswordChanged = () => {
    setNotice(t('home.passwordChanged'))
    setTimeout(() => setNotice(''), 4000)
    setPasswordTarget(null)
  }

  return (
    <div>
      <div className="flex flex-wrap justify-between items-center gap-2 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('home.title')}</h1>
        {admin && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            {t('home.newTournament')}
          </button>
        )}
      </div>

      {notice && (
        <div className="mb-4 rounded-md bg-green-50 border border-green-200 px-4 py-3 text-green-800">
          {notice}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : tournaments.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <p className="text-2xl mb-2">🎱</p>
          <p className="text-lg">{t('home.noTournaments')}</p>
          <p className="text-sm text-gray-400 mt-1">{t('home.noTournamentsHint')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tournaments.map((tournament) => (
            <TournamentCard
              key={tournament.id}
              tournament={tournament}
              onChangePassword={admin ? () => setPasswordTarget(tournament) : null}
            />
          ))}
        </div>
      )}

      {showCreateModal && (
        <CreateTournamentModal
          onClose={() => setShowCreateModal(false)}
          onCreated={handleTournamentCreated}
        />
      )}

      {passwordTarget && (
        <ChangeTournamentPasswordModal
          tournament={passwordTarget}
          onClose={() => setPasswordTarget(null)}
          onChanged={handlePasswordChanged}
        />
      )}
    </div>
  )
}

export default HomePage
