import { useTranslation } from 'react-i18next'

const BOX_H = 60
const GAP = 24
const COL_W = 240
const GUTTER_W = 56
const UNIT = BOX_H + GAP
const TOTAL_H = 4 * UNIT

const leafCenter = (i) => i * UNIT + BOX_H / 2
const mid = (a, b) => (a + b) / 2
const sfCenter = (j) => mid(leafCenter(2 * j), leafCenter(2 * j + 1))
const FINAL_CENTER = mid(sfCenter(0), sfCenter(1))
const BRONZE_CENTER = FINAL_CENTER + UNIT

const STATUS_DOT = {
  completed: { bg: '#22c55e', title: 'completed' },
  started: { bg: '#f59e0b', title: 'started' },
  pending: { bg: '#cbd5e1', title: 'pending' },
}

function GutterLines({ groups, width = GUTTER_W, height = TOTAL_H }) {
  const sourceYs = [...new Set(groups.flatMap((g) => g.sources))]
  const maxRail = Math.max(...groups.map((g) => g.railX))
  return (
    <div style={{ position: 'relative', width, height }}>
      {sourceYs.map((y) => (
        <div
          key={`s${y}`}
          className="absolute"
          style={{ left: 0, top: y - 0.5, width: maxRail, borderTop: '1px solid #94a3b8' }}
        />
      ))}
      {groups.map((g, gi) => {
        const lo = Math.min(...g.sources)
        const hi = Math.max(...g.sources)
        return (
          <div key={gi}>
            <div
              className="absolute"
              style={{ left: g.railX - 0.5, top: lo, height: hi - lo, borderLeft: '1px solid #94a3b8' }}
            />
            <div
              className="absolute"
              style={{ left: g.railX, top: g.target - 0.5, width: width - g.railX, borderTop: '1px solid #94a3b8' }}
            />
          </div>
        )
      })}
    </div>
  )
}

function MatchBox({ match, top, header, divisionByPlayer }) {
  const { t } = useTranslation()
  const tag = (playerId) => divisionByPlayer?.[playerId] && `${divisionByPlayer[playerId].division}${divisionByPlayer[playerId].rank}`

  const status = match?.status === 'completed' ? 'completed' : match?.status === 'started' ? 'started' : 'pending'
  const dot = STATUS_DOT[status]

  const row = (playerId, name, frames, isWinner) => (
    <div
      key={playerId ?? name}
      className="flex justify-between items-baseline gap-2"
      style={{
        fontSize: 12,
        lineHeight: '16px',
        color: isWinner ? '#0f172a' : '#475569',
        fontWeight: isWinner ? 600 : 400,
      }}
    >
      <span className="truncate" title={name}>
        {tag(playerId) && <span className="text-slate-400 font-normal">{tag(playerId)} </span>}
        {name}
      </span>
      <span>{frames ?? (match?.winner_id ? '–' : '–')}</span>
    </div>
  )

  if (!match) {
    return (
      <div
        className="flex flex-col justify-center items-center text-slate-300"
        style={{
          position: 'absolute',
          top,
          left: 0,
          width: '100%',
          height: BOX_H,
          border: '1px dashed #cbd5e1',
          borderRadius: 6,
          fontSize: 11,
        }}
      >
        <span>{header}</span>
        <span>{t('tournament.pending')}</span>
      </div>
    )
  }

  return (
    <div
      className="flex flex-col"
      style={{
        position: 'absolute',
        top,
        left: 0,
        width: '100%',
        height: BOX_H,
        border: '1px solid #94a3b8',
        borderRadius: 6,
        background: 'rgba(248, 250, 252, 0.9)',
        padding: '5px 8px',
        boxSizing: 'border-box',
      }}
    >
      <div className="flex justify-between items-center" style={{ fontSize: 10, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em', lineHeight: '12px' }}>
        <span>{header}</span>
        <span title={status} style={{ width: 6, height: 6, borderRadius: '50%', background: dot.bg }} />
      </div>
      {row(match.player1_id, match.player1_name, match.player1_frames, match.winner_id === match.player1_id)}
      {row(match.player2_id, match.player2_name, match.player2_frames, match.winner_id === match.player2_id)}
    </div>
  )
}

export default function PlayoffBracket({ matches, divisionByPlayer }) {
  const { t } = useTranslation()
  const byRound = (round) => matches.filter((m) => m.round === round).sort((a, b) => a.match_order - b.match_order)
  const qfs = byRound('quarter_final')
  const sfs = byRound('semi_final')
  const finalMatch = byRound('final')[0]
  const bronzeMatch = byRound('bronze')[0]

  // Visual leaf order makes every semi pair its own adjacent feeder pair:
  // leaves are QF(match_order 1), QF(4), QF(2), QF(3).
  const qfAt = (i) => qfs[[0, 3, 1, 2][i]]
  const sfAt = (j) => sfs[j]

  const roundHeaders = {
    quarter_final: t('tournament.quarterFinals'),
    semi_final: t('tournament.semiFinals'),
    final: t('tournament.final'),
    bronze: t('tournament.bronze'),
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex items-start" style={{ minWidth: 3 * COL_W + 2 * GUTTER_W }}>
        <div style={{ width: COL_W }}>
          <div className="text-center text-xs font-medium text-slate-500 mb-2">{roundHeaders.quarter_final}</div>
          <div style={{ position: 'relative', width: COL_W, height: TOTAL_H }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={`qf-${i}`}>
                <MatchBox match={qfAt(i)} top={i * UNIT} header={`QF ${i + 1}`} divisionByPlayer={divisionByPlayer} />
              </div>
            ))}
          </div>
        </div>
        <div style={{ width: GUTTER_W, paddingTop: 24 }}>
          <GutterLines
            groups={[
              { sources: [leafCenter(0), leafCenter(1)], target: sfCenter(0), railX: GUTTER_W - 26 },
              { sources: [leafCenter(2), leafCenter(3)], target: sfCenter(1), railX: GUTTER_W - 26 },
            ]}
          />
        </div>
        <div style={{ width: COL_W }}>
          <div className="text-center text-xs font-medium text-slate-500 mb-2">{roundHeaders.semi_final}</div>
          <div style={{ position: 'relative', width: COL_W, height: TOTAL_H }}>
            {[0, 1].map((j) => (
              <div key={`sf-${j}`}>
                <MatchBox match={sfAt(j)} top={sfCenter(j) - BOX_H / 2} header={`SF ${j + 1}`} divisionByPlayer={divisionByPlayer} />
              </div>
            ))}
          </div>
        </div>
        <div style={{ width: GUTTER_W, paddingTop: 24 }}>
          <GutterLines
            groups={[
              { sources: [sfCenter(0), sfCenter(1)], target: FINAL_CENTER, railX: GUTTER_W - 30 },
              { sources: [sfCenter(0), sfCenter(1)], target: BRONZE_CENTER, railX: GUTTER_W - 14 },
            ]}
          />
        </div>
        <div style={{ width: COL_W }}>
          <div className="text-center text-xs font-medium text-slate-500 mb-2">{roundHeaders.final}</div>
          <div style={{ position: 'relative', width: COL_W, height: TOTAL_H }}>
            <MatchBox match={finalMatch} top={FINAL_CENTER - BOX_H / 2} header={roundHeaders.final} divisionByPlayer={divisionByPlayer} />
            <MatchBox match={bronzeMatch} top={BRONZE_CENTER - BOX_H / 2} header={roundHeaders.bronze} divisionByPlayer={divisionByPlayer} />
          </div>
        </div>
      </div>
    </div>
  )
}