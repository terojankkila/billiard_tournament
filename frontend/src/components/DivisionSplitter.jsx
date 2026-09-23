import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { tournamentService } from '../services/api'

function DivisionSplitter({ tournamentId, tournamentPlayers, onClose, onSaved }) {
  const { t } = useTranslation()
  const [groups, setGroups] = useState({ A: [], B: [] })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const nameById = (id) => tournamentPlayers.find(p => p.id === id)?.name ?? id

  const loadPreview = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await tournamentService.previewDivisions(tournamentId)
      setGroups(res.data)
    } catch (err) {
      setError(err.response?.data?.error || err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadPreview() }, [tournamentId])

  const movePlayer = (playerId, from, to) => {
    setGroups(prev => ({
      ...prev,
      [from]: prev[from].filter(id => id !== playerId),
      [to]: [...prev[to], playerId],
    }))
  }

  const diff = Math.abs(groups.A.length - groups.B.length)
  const canSave = !loading && groups.A.length >= 4 && groups.B.length >= 4 && diff <= 1

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const assignments = [
        ...groups.A.map(player_id => ({ player_id, division: 'A' })),
        ...groups.B.map(player_id => ({ player_id, division: 'B' })),
      ]
      await tournamentService.saveDivisions(tournamentId, assignments)
      onSaved()
    } catch (err) {
      setError(err.response?.data?.error || err.message)
      setSaving(false)
    }
  }

  const renderDivision = (division) => (
    <div className="flex-1 bg-white rounded-lg shadow p-4">
      <h4 className="font-semibold text-gray-800 mb-2">
        {t('tournament.division', { division })} ({groups[division].length} {t('common.players')})
      </h4>
      <ul className="space-y-1">
        {groups[division].map((playerId) => (
          <li key={playerId} className="flex items-center justify-between py-1 px-2 bg-gray-50 rounded">
            <span className="text-sm text-gray-800">{nameById(playerId)}</span>
            <button
              onClick={() => movePlayer(playerId, division, division === 'A' ? 'B' : 'A')}
              className="px-2 py-0.5 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
            >
              {division === 'A' ? t('tournament.moveToB') : t('tournament.moveToA')}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{t('tournament.splitDivisions')}</h3>
            <p className="text-sm text-gray-500 mt-1">{t('tournament.splitDivisionsNote')}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl"
            aria-label={t('common.cancel')}
          >
            ×
          </button>
        </div>

        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-4">
          {t('tournament.unsavedDivisions')}
        </p>

        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

        <div className="flex justify-between items-center mb-4">
          <button
            onClick={loadPreview}
            disabled={loading}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50"
          >
            {loading ? t('tournament.loading') : t('tournament.reshuffle')}
          </button>
          <p className="text-sm text-gray-500">{t('tournament.balanceHint')}</p>
        </div>

        <div className="flex gap-4">
          {renderDivision('A')}
          {renderDivision('B')}
        </div>

        <div className="flex justify-end space-x-2 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {saving ? t('tournament.saving') : t('tournament.saveDivisions')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default DivisionSplitter