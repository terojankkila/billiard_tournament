module.exports = {
  createTables: [
    `CREATE TABLE IF NOT EXISTS tournaments (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      password VARCHAR(255) NOT NULL,
      status VARCHAR(50) DEFAULT 'setup',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,

    `CREATE TABLE IF NOT EXISTS players (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,

    `CREATE TABLE IF NOT EXISTS tournament_players (
      id SERIAL PRIMARY KEY,
      tournament_id INTEGER REFERENCES tournaments(id) ON DELETE CASCADE,
      player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tournament_id, player_id)
    );`,

    `CREATE TABLE IF NOT EXISTS matches (
      id SERIAL PRIMARY KEY,
      tournament_id INTEGER REFERENCES tournaments(id) ON DELETE CASCADE,
      player1_id INTEGER REFERENCES players(id),
      player2_id INTEGER REFERENCES players(id),
      player1_frames INTEGER DEFAULT 0,
      player2_frames INTEGER DEFAULT 0,
      round VARCHAR(50) NOT NULL,
      round_number INTEGER,
      match_order INTEGER,
      status VARCHAR(50) DEFAULT 'pending',
      winner_id INTEGER REFERENCES players(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,

    `ALTER TABLE matches ADD COLUMN IF NOT EXISTS round_number INTEGER;`,
    `ALTER TABLE matches ADD COLUMN IF NOT EXISTS is_started BOOLEAN DEFAULT FALSE;`,
    `ALTER TABLE tournament_players ADD COLUMN IF NOT EXISTS division VARCHAR(2);`,

    `CREATE TABLE IF NOT EXISTS frames (
      id SERIAL PRIMARY KEY,
      match_id INTEGER REFERENCES matches(id) ON DELETE CASCADE,
      frame_number INTEGER NOT NULL,
      winner_id INTEGER REFERENCES players(id),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,

    `CREATE TABLE IF NOT EXISTS admins (
      id SERIAL PRIMARY KEY,
      username VARCHAR(100) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      is_default BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );`,
  ],

  adminCount: 'SELECT COUNT(*)::int as count FROM admins',

  seedAdmin: (username, passwordHash) =>
    `INSERT INTO admins (username, password_hash, is_default) VALUES ('${username}', '${passwordHash}', true)`,
};
