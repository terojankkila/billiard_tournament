module.exports = {
  insert: (pool, name, hashedPassword) =>
    pool.query(
      'INSERT INTO tournaments (name, password) VALUES ($1, $2) RETURNING id, name, status, created_at',
      [name, hashedPassword]
    ),

  getById: (pool, id) =>
    pool.query('SELECT id, name, status, created_at FROM tournaments WHERE id = $1', [id]),

  getByIdWithPassword: (pool, id) =>
    pool.query('SELECT * FROM tournaments WHERE id = $1', [id]),

  list: (pool) =>
    pool.query('SELECT id, name, status, created_at FROM tournaments ORDER BY created_at DESC'),

  updateStatus: (pool, status, id) =>
    pool.query('UPDATE tournaments SET status = $1 WHERE id = $2', [status, id]),

  // Changing the password also bumps token_version so previously issued
  // tournament access tokens stop working.
  updatePassword: (pool, hashedPassword, id) =>
    pool.query(
      `UPDATE tournaments
       SET password = $1, token_version = COALESCE(token_version, 0) + 1
       WHERE id = $2
       RETURNING id, name, status, token_version`,
      [hashedPassword, id]
    ),

  getTokenVersion: (pool, id) =>
    pool.query('SELECT COALESCE(token_version, 0) AS token_version FROM tournaments WHERE id = $1', [id]),
};
