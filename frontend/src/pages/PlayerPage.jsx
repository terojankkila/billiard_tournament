import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { playerService } from '../services/api'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line
} from 'recharts'

function AllPlayersStats({ stats, onSelectPlayer }) {
  const { t } = useTranslation()
  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold text-gray-800 mb-3">{t('players.allPlayers')}</h2>
      {stats.length === 0 ? (
        <p className="text-gray-500">{t('players.noData')}</p>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('players.colPlayer')}</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{t('players.colMatchesPlayed')}</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{t('players.colMatchesWon')}</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{t('players.colMatchWinPct')}</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{t('players.colFramesWon')}</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{t('players.colFramesLost')}</th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{t('players.colFrameWinPct')}</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {stats.map((s, i) => (
                  <tr
                    key={s.id}
                    className="hover:bg-blue-50 cursor-pointer"
                    onClick={() => onSelectPlayer(String(s.id))}
                  >
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{i + 1}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{s.name}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">{s.matches_played}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-800 text-center font-medium">{s.matches_won}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                      <span className={`font-medium ${s.match_win_pct >= 50 ? 'text-green-600' : 'text-red-500'}`}>
                        {s.match_win_pct}%
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">{s.frames_won}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">{s.frames_lost}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-center">
                      <span className={`font-medium ${s.frame_win_pct >= 50 ? 'text-green-600' : 'text-red-500'}`}>
                        {s.frame_win_pct}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function PlayerPage() {
  const { t } = useTranslation()
  const [players, setPlayers] = useState([])
  const [allStats, setAllStats] = useState([])
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [playerStats, setPlayerStats] = useState([])

  useEffect(() => {
    fetchAllStats()
  }, [])

  const fetchAllStats = async () => {
    try {
      const [allStatsRes, playersRes] = await Promise.all([
        playerService.getAllStats(),
        playerService.getAll(),
      ])
      setAllStats(allStatsRes.data)
      setPlayers(playersRes.data)
    } catch (err) {
      console.error('Error fetching player stats:', err)
    }
  }

  const handleSelectPlayer = async (playerId) => {
    if (!playerId) {
      setSelectedPlayer(null)
      setPlayerStats([])
      return
    }
    try {
      const result = await playerService.getStats(playerId)
      setSelectedPlayer(playerId)
      setPlayerStats(result.data)
    } catch (err) {
      console.error('Error fetching player stats:', err)
    }
  }

  const chartData = playerStats.map(tournament => ({
    name: tournament.tournament_name,
    frames_won: parseInt(tournament.frames_won),
    matches_won: parseInt(tournament.matches_won),
    matches_played: parseInt(tournament.matches_played),
    frames_lost: parseInt(tournament.frames_lost),
  }))

  const selectedPlayerName = players.find(p => String(p.id) === String(selectedPlayer))?.name

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('players.title')}</h1>

      <AllPlayersStats stats={allStats} onSelectPlayer={handleSelectPlayer} />

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {t('players.selectPlayer')}
        </label>
        <select
          onChange={(e) => handleSelectPlayer(e.target.value)}
          className="w-full max-w-md border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={selectedPlayer || ''}
        >
          <option value="">{t('players.choosePlayer')}</option>
          {players.map(player => (
            <option key={player.id} value={player.id}>{player.name}</option>
          ))}
        </select>
      </div>

      {selectedPlayer && playerStats.length > 0 && (
        <>
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-3">
              {t('players.breakdownTitle', { name: selectedPlayerName })}
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="text-sm font-medium text-gray-600 mb-3">{t('players.framesWonVsLost')}</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="frames_won" fill="#3B82F6" name={t('players.framesWon')} />
                    <Bar dataKey="frames_lost" fill="#EF4444" name={t('players.framesLost')} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white rounded-lg shadow p-4">
                <h3 className="text-sm font-medium text-gray-600 mb-3">{t('players.matchWinsOverTime')}</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="matches_won" stroke="#10B981" name={t('players.matchWins')} />
                    <Line type="monotone" dataKey="matches_played" stroke="#3B82F6" name={t('players.matchesPlayed')} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">{t('players.history')}</h3>
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('players.colTournament')}</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{t('players.colMatchesPlayed')}</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{t('players.colMatchesWon')}</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{t('players.colFramesWon')}</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{t('players.colFramesLost')}</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {playerStats.map((tournament) => (
                      <tr key={tournament.tournament_id}>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{tournament.tournament_name}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">{tournament.matches_played}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">{tournament.matches_won}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">{tournament.frames_won}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 text-center">{tournament.frames_lost}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default PlayerPage
