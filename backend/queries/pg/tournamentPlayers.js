module.exports = {
  insert: (pool, tournamentId, playerId) =>
    pool.query(
      'INSERT INTO tournament_players (tournament_id, player_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [tournamentId, playerId]
    ),

  list: (pool, tournamentId) =>
    pool.query(
      `SELECT p.* FROM players p
       JOIN tournament_players tp ON p.id = tp.player_id
       WHERE tp.tournament_id = $1`,
      [tournamentId]
    ),

  listWithDivision: (pool, tournamentId) =>
    pool.query(
      `SELECT p.id, p.name, tp.division
       FROM players p
       JOIN tournament_players tp ON p.id = tp.player_id
       WHERE tp.tournament_id = $1
       ORDER BY tp.division NULLS LAST, p.name`,
      [tournamentId]
    ),

  getPlayerIds: (pool, tournamentId) =>
    pool.query(
      'SELECT player_id FROM tournament_players WHERE tournament_id = $1',
      [tournamentId]
    ),

  clearDivisions: (pool, tournamentId) =>
    pool.query(
      'UPDATE tournament_players SET division = NULL WHERE tournament_id = $1',
      [tournamentId]
    ),

  setDivision: (pool, tournamentId, playerId, division) =>
    pool.query(
      `UPDATE tournament_players SET division = $3
       WHERE tournament_id = $1 AND player_id = $2`,
      [tournamentId, playerId, division]
    ),

  hasDivisions: (pool, tournamentId) =>
    pool.query(
      'SELECT COUNT(*)::int as count FROM tournament_players WHERE tournament_id = $1 AND division IS NOT NULL',
      [tournamentId]
    ),

  getDivisionIds: (pool, tournamentId, division) =>
    pool.query(
      'SELECT player_id FROM tournament_players WHERE tournament_id = $1 AND division = $2',
      [tournamentId, division]
    ),
};
