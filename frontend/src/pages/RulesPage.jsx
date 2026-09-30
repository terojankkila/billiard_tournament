import { Trans, useTranslation } from 'react-i18next'

function RulesPage() {
  const { t } = useTranslation()

  const Section = ({ title, children }) => (
    <div className="bg-white rounded-lg shadow p-5 mb-4">
      <h2 className="text-lg font-semibold text-gray-800 mb-3">{title}</h2>
      <div className="text-gray-700 space-y-2 leading-relaxed">{children}</div>
    </div>
  )

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{t('rules.title')}</h1>

      <div className="bg-yellow-50 border border-yellow-300 rounded-md p-4 mb-6">
        <h2 className="text-lg font-semibold text-yellow-800 mb-2">{t('rules.deadlineTitle')}</h2>
        <p className="text-yellow-900 leading-relaxed">
          <Trans i18nKey="rules.deadlineIntro" values={{}}>
            Every match must be played within <strong>two (2) weeks</strong> of the round starting. If a match has
            not been played when the deadline passes, the game is awarded <strong>3–0</strong> to the participant
            who is ready and willing to play. If neither participant is willing to play, the match is decided by
            the tournament admin.
          </Trans>
        </p>
      </div>

      <Section title={t('rules.objectiveTitle')}>
        <p>
          <Trans i18nKey="rules.objectiveText">
            Each tournament is played as <strong>round robin</strong> followed by <strong>playoffs</strong>. The
            goal is to finish with the most points after all round-robin matches, then win through the playoffs to
            become the tournament champion.
          </Trans>
        </p>
      </Section>

      <Section title={t('rules.structureTitle')}>
        <ul className="list-disc list-inside space-y-1">
          <li>{t('rules.structure1')}</li>
          <li>{t('rules.structure2')}</li>
          <li>
            <Trans i18nKey="rules.structure3">
              Round-robin matches are generated in <strong>rounds</strong> — each player plays exactly one match
              per round, facing every other player once.
            </Trans>
          </li>
          <li>
            <Trans i18nKey="rules.structure4">
              After all round-robin matches are complete, the <strong>top 8 players</strong> in the standings
              advance to the playoffs.
            </Trans>
          </li>
        </ul>
      </Section>

      <Section title={t('rules.matchTitle')}>
        <p>
          <Trans i18nKey="rules.matchText">
            Every match is played as <strong>best of five (first to 3) frames</strong>. The player who wins a frame
            scores a point for that frame, and the player who reaches 3 frames wins the match.
          </Trans>
        </p>
        <p>{t('rules.matchText2')}</p>
      </Section>

      <Section title={t('rules.scoringTitle')}>
        <ul className="list-disc list-inside space-y-1">
          <li>
            <Trans i18nKey="rules.scoring1">
              Each frame won = <strong>1 point</strong>.
            </Trans>
          </li>
          <li>
            <Trans i18nKey="rules.scoring2">
              Winning the match (first to 3 frames) = <strong>1 additional point</strong>.
            </Trans>
          </li>
          <li>
            <Trans i18nKey="rules.scoring3">
              So a 3–2 match win earns <strong>4 points</strong> (3 frames + 1 match win).
            </Trans>
          </li>
        </ul>
        <p className="pt-1">
          <Trans i18nKey="rules.scoringText">
            Standings are ranked by <strong>total points</strong>, then frames won, then matches won.
          </Trans>
        </p>
      </Section>

      <Section title={t('rules.playingTitle')}>
        <ul className="list-disc list-inside space-y-1">
          <li>
            <Trans i18nKey="rules.playing1">
              Only matches in the <strong>current round</strong> can be started.
            </Trans>
          </li>
          <li>
            <Trans i18nKey="rules.playing2">
              Both participants agree on a time and play within the <strong>two-week deadline</strong>.
            </Trans>
          </li>
          <li>{t('rules.playing3')}</li>
          <li>{t('rules.playing4')}</li>
        </ul>
      </Section>

      <Section title={t('rules.playoffsTitle')}>
        <ul className="list-disc list-inside space-y-1">
          <li>{t('rules.playoffs1')}</li>
          <li>{t('rules.playoffs2')}</li>
          <li>
            <Trans i18nKey="rules.playoffs3">
              The winner of 1st vs 8th plays the winner of 4th vs 5th, and the winner of 2nd vs 7th plays the
              winner of 3rd vs 6th. The two semi-final winners meet in the final, and the two semi-final losers
              play a bronze match for third place.
            </Trans>
          </li>
        </ul>
      </Section>

      <Section title={t('rules.divisionTitle')}>
        <ul className="list-disc list-inside space-y-1">
          <li>{t('rules.division1')}</li>
          <li>{t('rules.division2')}</li>
          <li>
            <Trans i18nKey="rules.division3">
              Playoffs: the <strong>top 4 of each division advance directly</strong> and play cross-division
              quarter finals — the 1st of Division A plays the 4th of Division B, the 2nd vs the 3rd, and so on.
              The final is played cross-division, and the semi-final losers play a bronze match for third place.
            </Trans>
          </li>
        </ul>
      </Section>
    </div>
  )
}

export default RulesPage