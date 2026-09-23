module.exports = {
getStandings: (pool, tournamentId) =>
    pool.query(
      `SELECT
         p.id as player_id,
         p.name,
         tp.division,
         COUNT(CASE WHEN m.winner_id = p.id THEN 1 END)::int as matches_won,
         COUNT(CASE WHEN m.status = 'completed' THEN 1 END)::int as matches_played,
         COALESCE(SUM(CASE WHEN m.player1_id = p.id THEN m.player1_frames
                           WHEN m.player2_id = p.id THEN m.player2_frames END), 0)::int as frames_won,
         COALESCE(SUM(CASE WHEN m.player1_id = p.id THEN m.player2_frames
                           WHEN m.player2_id = p.id THEN m.player1_frames END), 0)::int as frames_lost,
         (COUNT(CASE WHEN m.winner_id = p.id THEN 1 END) +
          COALESCE(SUM(CASE WHEN m.player1_id = p.id THEN m.player1_frames
                            WHEN m.player2_id = p.id THEN m.player2_frames END), 0))::int as total_points
       FROM tournament_players tp
       JOIN players p ON tp.player_id = p.id
       LEFT JOIN matches m ON (m.player1_id = p.id OR m.player2_id = p.id)
         AND m.tournament_id = tp.tournament_id AND m.status = 'completed' AND m.round = 'round_robin'
       WHERE tp.tournament_id = $1
       GROUP BY p.id, p.name, tp.division
       ORDER BY tp.division NULLS LAST, total_points DESC, frames_won DESC, matches_won DESC`,
      [tournamentId]
    ),

  getTopN: (pool, tournamentId, n) =>
    pool.query(
      `SELECT
         p.id as player_id,
         p.name,
         (COUNT(CASE WHEN m.winner_id = p.id THEN 1 END) +
          COALESCE(SUM(CASE WHEN m.player1_id = p.id THEN m.player1_frames
                           WHEN m.player2_id = p.id THEN m.player2_frames END), 0))::int as total_points
       FROM tournament_players tp
       JOIN players p ON tp.player_id = p.id
       LEFT JOIN matches m ON (m.player1_id = p.id OR m.player2_id = p.id)
         AND m.tournament_id = tp.tournament_id AND m.status = 'completed' AND m.round = 'round_robin'
       WHERE tp.tournament_id = $1
       GROUP BY p.id, p.name
       ORDER BY total_points DESC
       LIMIT $2`,
      [tournamentId, n]
    ),

  getDivisionTopN: (pool, tournamentId, division, n) =>
    pool.query(
      `SELECT
         p.id as player_id,
         p.name,
         (COUNT(CASE WHEN m.winner_id = p.id THEN 1 END) +
          COALESCE(SUM(CASE WHEN m.player1_id = p.id THEN m.player1_frames
                            WHEN m.player2_id = p.id THEN m.player2_frames END), 0))::int as total_points,
         COUNT(CASE WHEN m.winner_id = p.id THEN 1 END)::int as matches_won,
         COALESCE(SUM(CASE WHEN m.player1_id = p.id THEN m.player1_frames
                            WHEN m.player2_id = p.id THEN m.player2_frames END), 0)::int as frames_won
       FROM tournament_players tp
       JOIN players p ON tp.player_id = p.id
       LEFT JOIN matches m ON (m.player1_id = p.id OR m.player2_id = p.id)
         AND m.tournament_id = tp.tournament_id AND m.status = 'completed' AND m.round = 'round_robin'
       WHERE tp.tournament_id = $1 AND tp.division = $2
       GROUP BY p.id, p.name
       ORDER BY total_points DESC, frames_won DESC, matches_won DESC
       LIMIT $3`,
      [tournamentId, division, n]
    ),

  getPlayerStats: (pool, playerId) =>
    pool.query(
      `SELECT
         t.id as tournament_id,
         t.name as tournament_name,
         COUNT(CASE WHEN m.winner_id = p.id THEN 1 END) as matches_won,
         COUNT(CASE WHEN m.status = 'completed' THEN 1 END) as matches_played,
         COALESCE(SUM(CASE WHEN m.player1_id = p.id THEN m.player1_frames
                          WHEN m.player2_id = p.id THEN m.player2_frames END), 0) as frames_won,
         COALESCE(SUM(CASE WHEN m.player1_id = p.id THEN m.player2_frames
                          WHEN m.player2_id = p.id THEN m.player1_frames END), 0) as frames_lost
       FROM tournaments t
       JOIN tournament_players tp ON t.id = tp.tournament_id
       JOIN players p ON tp.player_id = p.id
       LEFT JOIN matches m ON (m.player1_id = p.id OR m.player2_id = p.id)
         AND m.tournament_id = t.id AND m.status = 'completed'
       WHERE p.id = $1
       GROUP BY t.id, t.name, p.id, p.name
       ORDER BY t.created_at DESC`,
      [playerId]
    ),

  getAllPlayers: (pool) =>
    pool.query(
      `SELECT
         p.id,
         p.name,
         COUNT(DISTINCT m.id)
           FILTER (WHERE m.status = 'completed')::int AS matches_played,
         COUNT(DISTINCT m.id)
           FILTER (WHERE m.status = 'completed' AND m.winner_id = p.id)::int AS matches_won,
         COALESCE(SUM(
           CASE WHEN m.player1_id = p.id THEN m.player1_frames
                WHEN m.player2_id = p.id THEN m.player2_frames
           END) FILTER (WHERE m.status = 'completed'), 0)::int AS frames_won,
         COALESCE(SUM(
           CASE WHEN m.player1_id = p.id THEN m.player2_frames
                WHEN m.player2_id = p.id THEN m.player1_frames
           END) FILTER (WHERE m.status = 'completed'), 0)::int AS frames_lost
       FROM players p
       JOIN tournament_players tp ON tp.player_id = p.id
       LEFT JOIN matches m ON m.tournament_id = tp.tournament_id
         AND (m.player1_id = p.id OR m.player2_id = p.id)
         AND m.status = 'completed'
       GROUP BY p.id, p.name
       ORDER BY matches_won DESC, frames_won DESC`
    ),
};
