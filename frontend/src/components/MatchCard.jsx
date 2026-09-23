import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { matchService } from '../services/api'

function MatchCard({ match, isCurrentRound = false, canEdit = true, onDataChanged }) {
  const { t } = useTranslation()
  const [frames, setFrames] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchFrames()
  }, [match.id])

  const fetchFrames = async () => {
    try {
      const result = await matchService.getFrames(match.id)
      setFrames(result.data)
    } catch (err) {
      console.error('Error fetching frames:', err)
      setFrames([])
    } finally {
      setLoading(false)
    }
  }

  const handleStart = async () => {
    try {
      await matchService.start(match.id)
      onDataChanged && onDataChanged()
    } catch (err) {
      alert(`${t('matchCard.errorStart')} ${err.response?.data?.error || err.message}`)
    }
  }

  const handleAddFrame = async (winnerId) => {
    const nextNumber = frames.length + 1
    try {
      await matchService.addFrame(match.id, { winner_id: winnerId, frame_number: nextNumber })
      await fetchFrames()
      onDataChanged && onDataChanged()
    } catch (err) {
      alert(`${t('matchCard.errorSaveFrame')} ${err.response?.data?.error || err.message}`)
    }
  }

  const handleDeleteFrame = async (frameNumber) => {
    if (!window.confirm(t('matchCard.confirmDeleteFrame', { frame: frameNumber }))) return
    try {
      await matchService.deleteFrame(match.id, frameNumber)
      await fetchFrames()
      onDataChanged && onDataChanged()
    } catch (err) {
      alert(`${t('matchCard.errorRemoveFrame')} ${err.response?.data?.error || err.message}`)
    }
  }

  const getMatchTitle = (round, roundNumber) => {
    if (round === 'round_robin') return t('matchCard.round', { round: roundNumber || '-' })
    switch (round) {
      case 'play_in': return t('matchCard.playIn')
      case 'quarter_final': return t('matchCard.quarterFinal')
      case 'semi_final': return t('matchCard.semiFinal')
      case 'final': return t('matchCard.final')
      default: return round
    }
  }

  const isCompleted = match.status === 'completed'
  const scoreReached = frames.length >= 5 || frames.filter(f => f.winner_id === match.player1_id).length >= 3 || frames.filter(f => f.winner_id === match.player2_id).length >= 3

  return (
    <div className="bg-white rounded-lg shadow-md p-4 w-80 m-2 border border-gray-200">
      <div className="text-center text-sm font-medium text-gray-600 mb-2">
        {getMatchTitle(match.round, match.round_number)}
      </div>
      <div className="flex items-center justify-between mb-3">
        <div className={`flex-1 text-center font-medium ${isCompleted && match.winner_id === match.player1_id ? 'text-green-600 font-bold' : 'text-gray-800'} border border-gray-200 rounded-md px-2 py-2`}>
          {match.player1_name}
        </div>
        <div className="px-2 text-center">
          <span className={`text-lg font-bold ${isCompleted ? 'text-gray-800' : 'text-gray-400'}`}>
            {match.player1_frames} - {match.player2_frames}
          </span>
        </div>
        <div className={`flex-1 text-center font-medium ${isCompleted && match.winner_id === match.player2_id ? 'text-green-600 font-bold' : 'text-gray-800'} border border-gray-200 rounded-md px-2 py-2`}>
          {match.player2_name}
        </div>
      </div>

      {isCompleted && (
        <div className="text-center mb-3 text-sm text-gray-600">
          {t('matchCard.winner')} <span className="font-bold text-green-600">{match.winner_name}</span>
        </div>
      )}

      <div className="border-t border-gray-100 pt-2 mb-3">
        {loading ? (
          <p className="text-xs text-gray-400 text-center py-1">{t('matchCard.loadingFrames')}</p>
        ) : frames.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-1">{t('matchCard.noFrames')}</p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {frames.map((frame) => {
              const wonByP1 = frame.winner_id === match.player1_id
              return (
                <span
                  key={frame.frame_number}
                  title={wonByP1 ? t('matchCard.frameWonBy', { player: match.player1_name }) : t('matchCard.frameWonBy', { player: match.player2_name })}
                  className="group relative inline-flex items-center px-2 py-1 rounded text-xs font-semibold"
                  style={{ backgroundColor: wonByP1 ? '#dbeafe' : '#fee2e2', color: wonByP1 ? '#1d4ed8' : '#b91c1c' }}
                >
                  F{frame.frame_number}
                  {canEdit && (
                    <button
                      onClick={() => handleDeleteFrame(frame.frame_number)}
                      className="ml-1 text-gray-400 hover:text-red-600 text-[10px] font-bold"
                      title={t('matchCard.deleteFrame')}
                    >
                      ×
                    </button>
                  )}
                </span>
              )
            })}
          </div>
        )}
      </div>

      {!isCompleted && match.is_started && !scoreReached && canEdit && (
        <div className="text-center mb-2">
          <p className="text-xs text-gray-500 mb-2">
            {t('matchCard.recordFrameWinner', { frame: frames.length + 1 })}
          </p>
          <div className="flex justify-center space-x-2">
            <button
              onClick={() => handleAddFrame(match.player1_id)}
              className="flex-1 px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700"
            >
              {match.player1_name}
            </button>
            <button
              onClick={() => handleAddFrame(match.player2_id)}
              className="flex-1 px-3 py-2 bg-red-500 text-white rounded-md text-sm hover:bg-red-600"
            >
              {match.player2_name}
            </button>
          </div>
        </div>
      )}

      {!isCompleted && match.is_started && !scoreReached && !canEdit && (
        <p className="text-center text-xs text-gray-400 mb-2">{t('matchCard.unlockToRecord')}</p>
      )}

      {!isCompleted && !match.is_started && canEdit && (
        <div className="text-center mb-2">
          {isCurrentRound ? (
            <button
              onClick={handleStart}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700"
            >
              {t('matchCard.startGame')}
            </button>
          ) : (
            <p className="text-sm text-gray-400 py-2">{t('matchCard.waitingForRounds')}</p>
          )}
        </div>
      )}
    </div>
  )
}

export default MatchCard