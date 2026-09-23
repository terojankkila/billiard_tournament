import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { tournamentService, playerService, setActiveTournament } from '../services/api'
import { useAuth } from '../context/AuthContext'
import StandingsTable from '../components/StandingsTable'
import MatchCard from '../components/MatchCard'
import PlayerSelector from '../components/PlayerSelector'
import PerformanceChart from '../components/PerformanceChart'
import DivisionSplitter from '../components/DivisionSplitter'

function UnlockModal({ onClose, onUnlocked }) {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      await onUnlocked(password)
    } catch (err) {
      setError(err.response?.status === 401 ? t('tournament.invalidPassword') : (err.response?.data?.error || err.message))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96">
        <h2 className="text-xl font-bold mb-4">{t('tournament.unlockTitle')}</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('tournament.password')}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
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
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {t('tournament.unlock')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function TournamentPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { admin } = useAuth()
  const [tournament, setTournament] = useState(null)
  const [players, setPlayers] = useState([])
  const [tournamentPlayers, setTournamentPlayers] = useState([])
  const [matches, setMatches] = useState([])
  const [standings, setStandings] = useState([])
  const [showPlayerSelector, setShowPlayerSelector] = useState(false)
  const [showDivisionSplitter, setShowDivisionSplitter] = useState(false)
  const [showUnlockModal, setShowUnlockModal] = useState(false)
  const [loading, setLoading] = useState(true)

  // A user can edit results if they're an admin, or if they hold a valid
  // tournament token for this tournament (obtained via the tournament password).
  const hasTournamentToken = localStorage.getItem(`tournament_token_${id}`)
  const canEdit = !!admin || !!hasTournamentToken

  useEffect(() => {
    setActiveTournament(id)
    fetchTournamentData()
    return () => setActiveTournament(null)
  }, [id])

  const fetchTournamentData = async () => {
    try {
      const [tournamentData, playersData, tournamentPlayersData, matchesData, standingsData] = await Promise.all([
        tournamentService.getById(id),
        playerService.getAll(),
        tournamentService.getPlayers(id),
        tournamentService.getMatches(id),
        tournamentService.getStandings(id),
      ])
      setTournament(tournamentData.data)
      setPlayers(playersData.data)
      setTournamentPlayers(tournamentPlayersData.data)
      setMatches(matchesData.data)
      setStandings(standingsData.data)
    } catch (err) {
      if (err.response?.status === 404) {
        navigate('/')
        return
      }
      console.error('Error fetching tournament data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleUnlock = async (password) => {
    const result = await tournamentService.verifyPassword(id, password)
    if (result.data.valid) {
      localStorage.setItem(`tournament_token_${id}`, result.data.token)
      setShowUnlockModal(false)
    } else {
      throw new Error('Invalid password')
    }
  }

  const handleAddPlayers = async (selectedPlayerIds) => {
    try {
      await tournamentService.addPlayers(id, selectedPlayerIds)
      setShowPlayerSelector(false)
      fetchTournamentData()
    } catch (err) {
      alert(`${t('tournament.errorAddPlayers')} ${err.response?.data?.error || err.message}`)
    }
  }

  const handleDivisionsSaved = async () => {
    setShowDivisionSplitter(false)
    fetchTournamentData()
  }

  const handleStartTournament = async () => {
    if (window.confirm(t('tournament.confirmStart'))) {
      try {
        await tournamentService.start(id)
        fetchTournamentData()
      } catch (err) {
        alert(`${t('tournament.errorStart')} ${err.response?.data?.error || err.message}`)
      }
    }
  }

  const handleStartPlayoffs = async () => {
    if (window.confirm(t('tournament.confirmStartPlayoffs'))) {
      try {
        await tournamentService.startPlayoffs(id)
        fetchTournamentData()
      } catch (err) {
        alert(`${t('tournament.errorStartPlayoffs')} ${err.response?.data?.error || err.message}`)
      }
    }
  }

  const handleDataChanged = () => {
    fetchTournamentData()
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-40">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!tournament) {
    return <div>{t('tournament.notFound')}</div>
  }

  // Check if all round-robin matches are completed
  const roundRobinMatches = matches.filter(m => m.round === 'round_robin')
  const allRoundRobinComplete = roundRobinMatches.length > 0 && roundRobinMatches.every(m => m.status === 'completed')

  // Group round-robin matches into rounds (each round every player plays once)
  const roundRobinByRound = roundRobinMatches.reduce((byRound, match) => {
    const r = match.round_number || 1
    if (!byRound[r]) byRound[r] = []
    byRound[r].push(match)
    return byRound
  }, {})
  const roundRobinRounds = Object.entries(roundRobinByRound)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
  const currentRound = roundRobinRounds.find(([, rm]) => !rm.every(m => m.status === 'completed'))?.[0] ?? null

  // Division format data (players fetched with their division assignment)
  const divisionPlayers = tournamentPlayers.filter(p => p.division)
  const hasDivisions = divisionPlayers.length > 0
  const divisionA = divisionPlayers.filter(p => p.division === 'A')
  const divisionB = divisionPlayers.filter(p => p.division === 'B')
  const standingsA = standings.filter(s => s.division === 'A')
  const standingsB = standings.filter(s => s.division === 'B')

  // Show player selector if in setup phase
  const showPlayerSetup = tournament.status === 'setup'

  return (
    <div>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{tournament.name}</h1>
          <span className="text-sm text-gray-500">
            {t('tournament.status')} {tournament.status === 'setup' ? t('tournament.statusSetup') : tournament.status === 'round_robin' ? t('tournament.statusRoundRobin') : tournament.status === 'playoffs' ? t('tournament.statusPlayoffs') : t('tournament.statusCompleted')}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          {!canEdit && (
            <button
              onClick={() => setShowUnlockModal(true)}
              className="px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-800"
              title={t('tournament.unlockHint')}
            >
              {t('tournament.unlockButton')}
            </button>
          )}
          {canEdit && tournament.status === 'setup' && (
            <>
              <button
                onClick={() => setShowPlayerSelector(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                {t('tournament.addPlayers')}
              </button>
              {tournamentPlayers.length >= 8 && (
                <button
                  onClick={() => setShowDivisionSplitter(true)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                >
                  {hasDivisions ? t('tournament.editDivisions') : t('tournament.splitDivisions')}
                </button>
              )}
              {tournamentPlayers.length >= 2 && (
                <button
                  onClick={handleStartTournament}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  {t('tournament.startTournament')}
                </button>
              )}
            </>
          )}
          {canEdit && allRoundRobinComplete && tournament.status === 'round_robin' && (
            <button
              onClick={handleStartPlayoffs}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
            >
              {t('tournament.startPlayoffs')}
            </button>
          )}
        </div>
      </div>

      {showPlayerSetup && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">{t('tournament.selectedPlayers')}</h2>
          <div className="bg-white rounded-lg shadow p-4">
            {tournamentPlayers.length === 0 ? (
              <p className="text-gray-500">{t('tournament.noPlayersSelected')}</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {tournamentPlayers.map((player) => (
                  <span
                    key={player.id}
                    className="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-sm"
                  >
                    {player.name}
                  </span>
                ))}
              </div>
            )}
            {hasDivisions && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="bg-indigo-50 rounded-lg p-4">
                  <h3 className="font-semibold text-indigo-800 mb-2">
                    {t('tournament.division', { division: 'A' })} ({divisionA.length} {t('common.players')})
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {divisionA.map((player) => (
                      <span key={player.id} className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm">
                        {player.name}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="bg-emerald-50 rounded-lg p-4">
                  <h3 className="font-semibold text-emerald-800 mb-2">
                    {t('tournament.division', { division: 'B' })} ({divisionB.length} {t('common.players')})
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {divisionB.map((player) => (
                      <span key={player.id} className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm">
                        {player.name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showPlayerSelector && (
        <PlayerSelector
          players={players}
          selectedPlayerIds={tournamentPlayers.map(p => p.id)}
          onAdd={handleAddPlayers}
          onClose={() => setShowPlayerSelector(false)}
        />
      )}

      {showDivisionSplitter && (
        <DivisionSplitter
          tournamentId={id}
          tournamentPlayers={tournamentPlayers}
          onClose={() => setShowDivisionSplitter(false)}
          onSaved={handleDivisionsSaved}
        />
      )}

      {showUnlockModal && (
        <UnlockModal
          onClose={() => setShowUnlockModal(false)}
          onUnlocked={handleUnlock}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">{t('tournament.standings')}</h2>
          {hasDivisions ? (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-indigo-800 mb-2">{t('tournament.division', { division: 'A' })}</h3>
                <StandingsTable standings={standingsA} />
              </div>
              <div>
                <h3 className="font-semibold text-emerald-800 mb-2">{t('tournament.division', { division: 'B' })}</h3>
                <StandingsTable standings={standingsB} />
              </div>
            </div>
          ) : (
            <StandingsTable standings={standings} />
          )}
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">{t('tournament.performanceTrend')}</h2>
          <PerformanceChart standings={standings} />
        </div>
      </div>

      {tournament.status !== 'setup' && (
        <div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            {tournament.status === 'playoffs' ? t('tournament.playoffMatches') : t('tournament.roundRobinMatches')}
          </h2>
          {matches.length === 0 ? (
            <p className="text-gray-500">{t('common.noMatchesYet')}</p>
          ) : (
            <div>
              {tournament.status === 'playoffs' && (
                <>
                  {matches.filter(m => m.round === 'play_in').length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-lg font-medium text-gray-700 mb-3">{t('tournament.qualifiers')}</h3>
                      <div className="flex flex-wrap gap-4">
                        {matches.filter(m => m.round === 'play_in').map((match) => (
                          <MatchCard
                            key={match.id}
                            match={match}
                            isCurrentRound
                            canEdit={canEdit}
                            onDataChanged={handleDataChanged}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="mb-6">
                    <h3 className="text-lg font-medium text-gray-700 mb-3">{t('tournament.quarterFinals')}</h3>
                    <div className="flex flex-wrap gap-4">
                      {matches.filter(m => m.round === 'quarter_final').map((match) => (
                        <MatchCard
                          key={match.id}
                          match={match}
                          isCurrentRound
                          canEdit={canEdit}
                          onDataChanged={handleDataChanged}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="mb-6">
                    <h3 className="text-lg font-medium text-gray-700 mb-3">{t('tournament.semiFinals')}</h3>
                    <div className="flex flex-wrap gap-4">
                      {matches.filter(m => m.round === 'semi_final').map((match) => (
                        <MatchCard
                          key={match.id}
                          match={match}
                          isCurrentRound
                          canEdit={canEdit}
                          onDataChanged={handleDataChanged}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="mb-6">
                    <h3 className="text-lg font-medium text-gray-700 mb-3">{t('tournament.final')}</h3>
                    <div className="flex flex-wrap gap-4">
                      {matches.filter(m => m.round === 'final').map((match) => (
                        <MatchCard
                          key={match.id}
                          match={match}
                          isCurrentRound
                          canEdit={canEdit}
                          onDataChanged={handleDataChanged}
                        />
                      ))}
                    </div>
                  </div>
                </>
              )}
              {tournament.status === 'completed' && matches.some(m => m.round === 'final' && m.status === 'completed') && (
                <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="text-lg font-bold text-green-800 mb-2">{t('tournament.champion')}</h3>
                  <p className="text-green-700 text-xl font-semibold">
                    {matches.find(m => m.round === 'final' && m.status === 'completed').winner_name}
                  </p>
                </div>
              )}
              <h3 className="text-lg font-medium text-gray-700 mb-3">
                {tournament.status === 'playoffs' || tournament.status === 'completed' ? t('tournament.roundRobinResults') : t('tournament.roundRobin')}
              </h3>
              <div className="space-y-6">
                {roundRobinRounds.length === 0 ? (
                  <p className="text-gray-500">{t('common.noMatchesYet')}</p>
                ) : (
                  roundRobinRounds.map(([round, roundMatches]) => {
                    const allComplete = roundMatches.every(m => m.status === 'completed')
                    return (
                      <div key={round}>
                        <div className="flex items-center gap-3 mb-3">
                          <h4 className="font-semibold text-gray-800 text-base">{t('tournament.round', { round })}</h4>
                          {allComplete ? (
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                              {t('common.completed')}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                              {t('common.inProgress')}
                            </span>
                          )}
                        </div>
                        <div className={`flex flex-wrap gap-4 ${round === currentRound ? '' : 'opacity-70'}`}>
                          {roundMatches.map((match) => (
                            <MatchCard
                              key={match.id}
                              match={match}
                              isCurrentRound={round === currentRound}
                              canEdit={canEdit}
                              onDataChanged={handleDataChanged}
                            />
                          ))}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default TournamentPage
