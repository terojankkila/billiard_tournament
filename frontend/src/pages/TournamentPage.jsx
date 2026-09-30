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
import PlayoffBracket from '../components/PlayoffBracket'

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
      <div className="bg-white rounded-lg p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto">
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

function Podium({ champion, second, third }) {
  const { t } = useTranslation()
  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
      <h2 className="text-lg font-bold text-green-800 mb-3">{t('tournament.champion')}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-lg border border-green-200 p-3">
          <div className="text-xs uppercase tracking-wider text-green-600 mb-1">{t('tournament.place1')}</div>
          <div className="text-xl font-bold text-gray-900 break-words">{champion}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">{t('tournament.place2')}</div>
          <div className="text-lg font-semibold text-gray-700 break-words">{second || '—'}</div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">{t('tournament.place3')}</div>
          <div className="text-lg font-semibold text-gray-700 break-words">{third || '—'}</div>
        </div>
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
  const divisionByPlayer = hasDivisions
    ? Object.fromEntries(standings.filter(s => s.division).map(s => [s.player_id, { division: s.division, rank: s.rank }]))
    : null

  // Show player selector if in setup phase
  const showPlayerSetup = tournament.status === 'setup'

  // Podium: champion = final winner, second = final loser, third = bronze winner.
  // The tournament is only marked completed once both the final and the bronze
  // game are done, so both places are normally available at this point.
  const completedFinal = matches.find(m => m.round === 'final' && m.status === 'completed')
  const completedBronze = matches.find(m => m.round === 'bronze' && m.status === 'completed')
  const showPodium = tournament.status === 'completed' && !!completedFinal
  const championName = completedFinal?.winner_name ?? null
  const secondPlaceName = completedFinal
    ? (completedFinal.winner_id === completedFinal.player1_id ? completedFinal.player2_name : completedFinal.player1_name)
    : null
  const thirdPlaceName = completedBronze?.winner_name ?? null

  return (
    <div>
      <div className="flex flex-wrap justify-between items-start gap-3 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{tournament.name}</h1>
          <span className="text-sm text-gray-500">
            {t('tournament.status')} {tournament.status === 'setup' ? t('tournament.statusSetup') : tournament.status === 'round_robin' ? t('tournament.statusRoundRobin') : tournament.status === 'playoffs' ? t('tournament.statusPlayoffs') : t('tournament.statusCompleted')}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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

      {showPodium && <Podium champion={championName} second={secondPlaceName} third={thirdPlaceName} />}

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
          {(tournament.status === 'playoffs' || (tournament.status === 'completed' && matches.some(m => m.round !== 'round_robin'))) && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-gray-800 mb-2">{t('tournament.playoffBracket')}</h2>
              <p className="text-xs text-gray-400 mb-2 lg:hidden">{t('tournament.swipeBracketHint')}</p>
              <PlayoffBracket matches={matches} divisionByPlayer={divisionByPlayer} />
            </div>
          )}
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            {tournament.status === 'playoffs' || matches.some(m => m.round !== 'round_robin') ? t('tournament.playoffMatches') : t('tournament.roundRobinMatches')}
          </h2>
          {matches.length === 0 ? (
            <p className="text-gray-500">{t('common.noMatchesYet')}</p>
          ) : (
            <div>
              {(tournament.status === 'playoffs' || (tournament.status === 'completed' && matches.some(m => m.round !== 'round_robin'))) && (
                <>
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
                  {matches.filter(m => m.round === 'bronze').length > 0 && (
                    <div className="mb-6">
                      <h3 className="text-lg font-medium text-gray-700 mb-3">{t('tournament.bronze')}</h3>
                      <div className="flex flex-wrap gap-4">
                        {matches.filter(m => m.round === 'bronze').map((match) => (
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
                </>
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
