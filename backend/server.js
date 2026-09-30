require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool, initDatabase } = require('./database');
const queries = require('./queries');

const app = express();
const FRONTEND_KEY = process.env.FRONTEND_KEY || 'dev-frontend-key';
const FRONTEND_ORIGINS = (process.env.FRONTEND_ORIGINS || 'http://localhost:5173,http://127.0.0.1:5173').split(',');
app.use(cors({ origin: FRONTEND_ORIGINS }));
app.use(express.json());

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

// ---- Frontend-origin verification ----
const requireFrontend = (req, res, next) => {
  if (req.headers['x-app-key'] !== FRONTEND_KEY) {
    return res.status(403).json({ error: 'Invalid request origin' });
  }
  next();
};

// ---- Tournament access ----
// Views (GET endpoints) are public: anyone can see a tournament, its players,
// matches, frames, and standings. Only editing a tournament's results requires
// authentication: either a valid tournament token (obtained via the tournament
// password) or a valid admin token. Admins can always edit scores.
const signTournamentToken = (tournamentId, tokenVersion = 0) => jwt.sign(
  { type: 'tournament', tid: tournamentId, tv: tokenVersion },
  JWT_SECRET,
  { expiresIn: '12h' }
);

// Resolve the tournament id a request refers to (either from :id or the match's tournament).
const resolveTournamentId = async (req) => {
  let tournamentId = Number(req.params.id);
  if (req.originalUrl.startsWith('/api/matches/')) {
    const result = await queries.matches.getTournamentId(pool, req.params.id);
    if (result.rows.length === 0) return null;
    tournamentId = result.rows[0].tournament_id;
  }
  return tournamentId;
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
};

// Requires an admin token for the request.
const requireAdmin = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  const payload = verifyToken(token);
  if (!payload || payload.type === 'tournament') {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  req.admin = { id: payload.id, username: payload.username };
  next();
};

// Requires edit access on the tournament the request refers to. A request is
// authorized if it carries a valid admin token OR a valid tournament token
// issued for that same tournament.
const requireEditAccess = async (req, res, next) => {
  try {
    const tournamentId = await resolveTournamentId(req);
    if (tournamentId === null) return res.status(404).json({ error: 'Tournament not found' });
    req.tournamentId = tournamentId;

    const header = req.headers.authorization || '';
    const adminToken = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (adminToken) {
      const adminPayload = verifyToken(adminToken);
      if (adminPayload && adminPayload.type !== 'tournament') {
        req.admin = { id: adminPayload.id, username: adminPayload.username };
        return next();
      }
    }

    const tournamentToken = req.headers['x-tournament-token'];
    if (!tournamentToken) {
      return res.status(401).json({ error: 'Authentication required to edit results' });
    }
    const payload = verifyToken(tournamentToken);
    if (!payload || payload.type !== 'tournament') {
      return res.status(401).json({ error: 'Invalid or expired tournament token' });
    }
    if (Number(payload.tid) !== tournamentId) {
      return res.status(403).json({ error: 'You do not have access to this tournament' });
    }
    // Tokens issued for a previous password stop working once an admin changes it.
    const versionResult = await queries.tournaments.getTokenVersion(pool, tournamentId);
    const currentVersion = versionResult.rows[0]?.token_version ?? 0;
    if (Number(payload.tv || 0) !== Number(currentVersion)) {
      return res.status(401).json({ error: 'Tournament password has changed, please unlock again' });
    }
    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

app.use('/api', requireFrontend);

// ---- Admin authentication ----
const signToken = (admin) => jwt.sign({ id: admin.id, username: admin.username, type: 'admin' }, JWT_SECRET, { expiresIn: '8h' });

// Get current admin / verify token
app.get('/api/auth/me', requireAdmin, async (req, res) => {
  try {
    const result = await queries.admin.getById(pool, req.admin.id);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Admin not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const result = await queries.admin.getByName(pool, username);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    const admin = result.rows[0];
    const valid = await bcrypt.compare(password, admin.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    res.json({ token: signToken(admin), admin: { id: admin.id, username: admin.username, is_default: admin.is_default } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin changes own password
app.put('/api/auth/password', requireAdmin, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'current_password and new_password are required' });
    }
    const result = await queries.admin.getByName(pool, req.admin.username);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Admin not found' });
    const admin = result.rows[0];
    const valid = await bcrypt.compare(current_password, admin.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    const hash = await bcrypt.hash(new_password, 10);
    await queries.admin.updatePassword(pool, hash, req.admin.id);
    res.json({ message: 'Password updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List all admins (admin only)
app.get('/api/admin/admins', requireAdmin, async (req, res) => {
  try {
    const result = await queries.admin.list(pool);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new admin (admin only)
app.post('/api/admin/admins', requireAdmin, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'username and password are required' });
    }
    const hash = await bcrypt.hash(password, 10);
    const result = await queries.admin.insert(pool, username, hash);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Username already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Delete an admin (admin only, cannot delete the last admin)
app.delete('/api/admin/admins/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (Number(id) === req.admin.id) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }
    const countResult = await queries.admin.count(pool);
    if (countResult.rows[0].count <= 1) {
      return res.status(400).json({ error: 'Cannot delete the last admin account' });
    }
    await queries.admin.delete(pool, id);
    res.json({ message: 'Admin deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- Shuffle + round-robin generation ----
const shuffle = (arr) => {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};

const generateRoundRobinRounds = (players) => {
  let list = shuffle(players.map(p => p.player_id));
  const oddCount = list.length % 2 === 1;
  if (oddCount) list.push(null);

  const numRounds = list.length - 1;
  const matchesPerRound = list.length / 2;
  const fixed = list[0];
  let rotating = list.slice(1);

  const rounds = [];
  for (let r = 0; r < numRounds; r++) {
    const current = [fixed, ...rotating];
    const round = [];
    for (let i = 0; i < matchesPerRound; i++) {
      const p1 = current[i];
      const p2 = current[current.length - 1 - i];
      if (p1 !== null && p2 !== null) {
        const pair = Math.random() < 0.5 ? [p1, p2] : [p2, p1];
        round.push({ player1_id: pair[0], player2_id: pair[1] });
      }
    }
    rounds.push(round);
    rotating = [rotating[rotating.length - 1], ...rotating.slice(0, -1)];
  }

  return rounds;
};

// ---- Tournament routes ----
app.post('/api/tournaments', requireAdmin, async (req, res) => {
  try {
    const { name, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await queries.tournaments.insert(pool, name, hashedPassword);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tournaments/:id/verify', async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    const result = await queries.tournaments.getByIdWithPassword(pool, id);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    const tournament = result.rows[0];
    const validPassword = await bcrypt.compare(password, tournament.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid password' });
    }
    res.json({ valid: true, token: signTournamentToken(tournament.id, tournament.token_version || 0), tournament: { id: tournament.id, name: tournament.name, status: tournament.status } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin changes a tournament's access password. Existing tournament tokens are
// invalidated (token_version bump), so everyone holding the old password has to
// unlock again with the new one.
app.put('/api/tournaments/:id/password', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    if (typeof password !== 'string' || password.length === 0) {
      return res.status(400).json({ error: 'password is required' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await queries.tournaments.updatePassword(pool, hashedPassword, id);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    res.json({ success: true, tournament: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/tournaments', async (req, res) => {
  try {
    const result = await queries.tournaments.list(pool);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/tournaments/:id', async (req, res) => {
  try {
    const result = await queries.tournaments.getById(pool, req.params.id);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Tournament not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- Player routes ----
app.get('/api/players', async (req, res) => {
  try {
    const result = await queries.players.list(pool);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/players', async (req, res) => {
  try {
    const { name } = req.body;
    const result = await queries.players.insert(pool, name);
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(400).json({ error: 'Player name already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// ---- Tournament player routes ----
app.post('/api/tournaments/:id/players', requireEditAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const { playerIds } = req.body;
    for (const playerId of playerIds) {
      await queries.tournamentPlayers.insert(pool, id, playerId);
    }
    const result = await queries.tournamentPlayers.list(pool, id);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/tournaments/:id/players', async (req, res) => {
  try {
    const result = await queries.tournamentPlayers.listWithDivision(pool, req.params.id);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- Division routes ----
// Returns a random two-way split of the tournament's players WITHOUT persisting
// it. The admin previews and adjusts it, then saves via PUT /divisions.
app.post('/api/tournaments/:id/divisions/preview', requireEditAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const playersResult = await queries.tournamentPlayers.getPlayerIds(pool, id);
    const playerIds = playersResult.rows.map(r => r.player_id);
    if (playerIds.length < 8) {
      return res.status(400).json({ error: 'Need at least 8 players to split the tournament into two divisions' });
    }
    const shuffled = shuffle(playerIds);
    const half = Math.ceil(shuffled.length / 2);
    const divisions = { A: [], B: [] };
    shuffled.forEach((playerId, i) => {
      divisions[i < half ? 'A' : 'B'].push(playerId);
    });
    res.json(divisions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Saves the final division assignments, replacing any previously saved ones.
app.put('/api/tournaments/:id/divisions', requireEditAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const { assignments } = req.body;
    if (!Array.isArray(assignments) || assignments.length === 0) {
      return res.status(400).json({ error: 'assignments are required' });
    }
    const playersResult = await queries.tournamentPlayers.getPlayerIds(pool, id);
    if (playersResult.rows.length !== assignments.length) {
      return res.status(400).json({ error: 'Every tournament player must be assigned to a division' });
    }
    const validPlayerIds = new Set(playersResult.rows.map(r => r.player_id));
    const counts = { A: 0, B: 0 };
    for (const a of assignments) {
      if (!validPlayerIds.has(a.player_id) || !['A', 'B'].includes(a.division)) {
        return res.status(400).json({ error: 'Invalid player or division in assignments' });
      }
      counts[a.division]++;
    }
    if (Math.abs(counts.A - counts.B) > 1) {
      return res.status(400).json({ error: 'Divisions must be balanced (at most one player difference)' });
    }
    if (counts.A < 4 || counts.B < 4) {
      return res.status(400).json({ error: 'Each division needs at least 4 players for the playoffs' });
    }
    await queries.tournamentPlayers.clearDivisions(pool, id);
    for (const a of assignments) {
      await queries.tournamentPlayers.setDivision(pool, id, a.player_id, a.division);
    }
    const result = await queries.tournamentPlayers.listWithDivision(pool, id);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- Start tournament ----
app.post('/api/tournaments/:id/start', requireEditAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const playersResult = await queries.tournamentPlayers.getPlayerIds(pool, id);
    if (playersResult.rows.length < 2) {
      return res.status(400).json({ error: 'Need at least 2 players to start tournament' });
    }
    const dividedResult = await queries.tournamentPlayers.hasDivisions(pool, id);
    const divided = dividedResult.rows[0].count > 0;
    if (divided && dividedResult.rows[0].count !== playersResult.rows.length) {
      return res.status(400).json({ error: 'Some players are not assigned to a division. Split the divisions again before starting.' });
    }
    let matchIndex = 0;
    let totalRounds = 0;
    const divisions = divided ? ['A', 'B'] : [null];
    for (const division of divisions) {
      const players = division
        ? (await queries.tournamentPlayers.getDivisionIds(pool, id, division)).rows
        : playersResult.rows;
      const rounds = generateRoundRobinRounds(players);
      totalRounds = Math.max(totalRounds, rounds.length);
      for (let r = 0; r < rounds.length; r++) {
        for (const { player1_id, player2_id } of rounds[r]) {
          matchIndex++;
          await queries.matches.insert(pool, id, player1_id, player2_id, 'round_robin', r + 1, matchIndex);
        }
      }
    }
    await queries.tournaments.updateStatus(pool, 'round_robin', id);
    res.json({ message: 'Tournament started', rounds: totalRounds });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- Match routes ----
app.get('/api/tournaments/:id/matches', async (req, res) => {
  try {
    const result = await queries.matches.getByTournament(pool, req.params.id);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Recompute a match's score, status, and winner from its frame records.
const loserOf = (match) =>
  (match.winner_id === match.player1_id ? match.player2_id : match.player1_id);

// A tournament is complete once the final and the bronze (3rd place) match are done.
async function maybeCompletePlayoffs(client, tournamentId) {
  const finalRes = await queries.matches.getByTournamentAndRound(client, tournamentId, 'final');
  const bronzeRes = await queries.matches.getByTournamentAndRound(client, tournamentId, 'bronze');
  const finals = finalRes.rows;
  const bronzes = bronzeRes.rows;
  if (finals.length === 0) return;
  if (bronzes.length === 0) return;
  const allDone = finals.every(m => m.status === 'completed') && bronzes.every(m => m.status === 'completed');
  if (allDone) await queries.tournaments.updateStatus(client, 'completed', tournamentId);
}

async function recomputeMatch(client, matchId) {
  const matchResult = await queries.matches.getById(client, matchId);
  const match = matchResult.rows[0];
  if (!match) throw new Error('Match not found');

  const framesResult = await queries.frames.getFrameWinners(client, matchId);
  const frameWinners = framesResult.rows.map(r => r.winner_id);

  const player1_frames = frameWinners.filter(w => w === match.player1_id).length;
  const player2_frames = frameWinners.filter(w => w === match.player2_id).length;
  const completed = Math.max(player1_frames, player2_frames) >= 3;
  const status = frameWinners.length === 0 ? 'pending' : (completed ? 'completed' : 'in_progress');
  const winner_id = completed
    ? (player1_frames > player2_frames ? match.player1_id : match.player2_id)
    : null;

  await queries.matches.updateScores(client, player1_frames, player2_frames, winner_id, status, matchId);

  const advanceDivisionRound = async (tId, completedRound) => {
    const roundMatches = await queries.matches.getByTournamentAndRound(client, tId, completedRound);
    if (!roundMatches.rows.every(m => m.status === 'completed')) return;
    const ordered = roundMatches.rows;

    if (completedRound === 'quarter_final') {
      const round1 = roundMatches.rows[0];
      const round2 = roundMatches.rows[1];
      const round3 = roundMatches.rows[2];
      const round4 = roundMatches.rows[3];
      // Semi finals: cross-division quarter-final winners meet (1st pairing with 4th, 2nd with 3rd).
      await queries.matches.insertSimple(
        client, tId,
        round1.winner_id, round4.winner_id,
        'semi_final', 1
      );
      await queries.matches.insertSimple(
        client, tId,
        round2.winner_id, round3.winner_id,
        'semi_final', 2
      );
    } else if (completedRound === 'semi_final') {
      await queries.matches.insertSimple(
        client, tId,
        ordered[0].winner_id, ordered[1].winner_id,
        'final', 1
      );
      await queries.matches.insertSimple(
        client, tId,
        loserOf(ordered[0]), loserOf(ordered[1]),
        'bronze', 1
      );
    }
  };

  if (completed && status === 'completed') {
    const { tournament_id, round } = match;
    const dividedResult = await queries.tournamentPlayers.hasDivisions(client, tournament_id);
    const divided = dividedResult.rows[0].count > 0;

    if (divided) {
      if (round === 'quarter_final' || round === 'semi_final') {
        await advanceDivisionRound(tournament_id, round);
      } else if (round === 'final' || round === 'bronze') {
        await maybeCompletePlayoffs(client, tournament_id);
      }
    } else if (round === 'quarter_final' || round === 'semi_final') {
      const roundMatches = await queries.matches.getByTournamentAndRound(client, tournament_id, round);
      if (roundMatches.rows.every(m => m.status === 'completed')) {
        if (round === 'quarter_final') {
          await queries.matches.insertSimple(
            client, tournament_id,
            roundMatches.rows[0].winner_id, roundMatches.rows[3].winner_id,
            'semi_final', 1
          );
          await queries.matches.insertSimple(
            client, tournament_id,
            roundMatches.rows[1].winner_id, roundMatches.rows[2].winner_id,
            'semi_final', 2
          );
        } else {
          await queries.matches.insertSimple(
            client, tournament_id,
            roundMatches.rows[0].winner_id, roundMatches.rows[1].winner_id,
            'final', 1
          );
          await queries.matches.insertSimple(
            client, tournament_id,
            loserOf(roundMatches.rows[0]), loserOf(roundMatches.rows[1]),
            'bronze', 1
          );
        }
      }
    } else if (round === 'final' || round === 'bronze') {
      await maybeCompletePlayoffs(client, tournament_id);
    }
  }

  return { player1_frames, player2_frames, status, winner_id };
}

async function isCurrentRoundMatch(client, match) {
  if (match.round !== 'round_robin') {
    return true;
  }
  const result = await queries.matches.getMinIncompleteRound(client, match.tournament_id);
  const currentRound = result.rows[0].current_round;
  return match.round_number === currentRound;
}

// Start a match (enable frame entry)
app.post('/api/matches/:id/start', requireEditAccess, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const matchResult = await queries.matches.getById(client, id);
    if (matchResult.rows.length === 0) return res.status(404).json({ error: 'Match not found' });
    const match = matchResult.rows[0];

    if (match.status === 'completed') {
      return res.status(400).json({ error: 'This match is already completed' });
    }
    if (!(await isCurrentRoundMatch(client, match))) {
      return res.status(400).json({ error: 'Only games in the current round can be started' });
    }
    if (match.is_started) {
      return res.status(400).json({ error: 'Match is already started' });
    }

    await queries.matches.updateStarted(client, id);
    res.json({ message: 'Match started' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ---- Frame routes ----
app.get('/api/matches/:id/frames', async (req, res) => {
  try {
    const result = await queries.frames.getByMatch(pool, req.params.id);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/matches/:id/frames', requireEditAccess, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { winner_id, frame_number } = req.body;

    const matchResult = await queries.matches.getById(client, id);
    if (matchResult.rows.length === 0) return res.status(404).json({ error: 'Match not found' });
    const match = matchResult.rows[0];

    if (!match.is_started) {
      return res.status(400).json({ error: 'Match has not been started yet' });
    }
    if (winner_id !== match.player1_id && winner_id !== match.player2_id) {
      return res.status(400).json({ error: 'Winner must be one of the two players in the match' });
    }

    const existing = await queries.frames.getByMatchAndNumber(client, id, frame_number);
    if (existing.rows.length > 0) {
      await queries.frames.update(client, winner_id, id, frame_number);
    } else {
      await queries.frames.insert(client, id, frame_number, winner_id);
    }

    const state = await recomputeMatch(client, id);
    res.json({ message: 'Frame saved', frames: { player1_frames: state.player1_frames, player2_frames: state.player2_frames, status: state.status, winner_id: state.winner_id } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.delete('/api/matches/:id/frames/:frameNumber', requireEditAccess, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id, frameNumber } = req.params;
    await queries.frames.delete(client, id, frameNumber);
    const state = await recomputeMatch(client, id);
    res.json({ message: 'Frame removed', frames: { player1_frames: state.player1_frames, player2_frames: state.player2_frames, status: state.status, winner_id: state.winner_id } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

app.put('/api/matches/:id', requireEditAccess, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { player1_frames, player2_frames, frames } = req.body;

    const matchResult = await queries.matches.getById(client, id);
    if (matchResult.rows.length === 0) return res.status(404).json({ error: 'Match not found' });
    const match = matchResult.rows[0];

    await queries.matches.deleteFrames(client, id);

    if (Array.isArray(frames)) {
      let p1 = 0, p2 = 0;
      for (let i = 0; i < frames.length; i++) {
        if (frames[i].winner_id !== match.player1_id && frames[i].winner_id !== match.player2_id) {
          throw new Error(`Frame ${i + 1} winner is not in the match`);
        }
        await queries.frames.insert(client, id, i + 1, frames[i].winner_id);
        if (frames[i].winner_id === match.player1_id) p1++; else p2++;
      }
    } else {
      const total = player1_frames + player2_frames;
      for (let i = 1; i <= total; i++) {
        const winner = i <= player1_frames ? match.player1_id : match.player2_id;
        await queries.frames.insert(client, id, i, winner);
      }
    }

    const state = await recomputeMatch(client, id);
    res.json({ message: 'Match result updated', ...state });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ---- Standings + stats routes ----
app.get('/api/tournaments/:id/standings', async (req, res) => {
  try {
    const result = await queries.stats.getStandings(pool, req.params.id);
    const rankByDivision = {};
    const standings = result.rows.map((row) => {
      const key = row.division || '_';
      rankByDivision[key] = (rankByDivision[key] || 0) + 1;
      return { ...row, rank: rankByDivision[key] };
    });
    res.json(standings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/tournaments/:id/playoffs', requireEditAccess, async (req, res) => {
  try {
    const { id } = req.params;
    const dividedResult = await queries.tournamentPlayers.hasDivisions(pool, id);
    const divided = dividedResult.rows[0].count > 0;

    if (divided) {
      const aResult = await queries.stats.getDivisionTopN(pool, id, 'A', 4);
      const bResult = await queries.stats.getDivisionTopN(pool, id, 'B', 4);
      if (aResult.rows.length < 4 || bResult.rows.length < 4) {
        return res.status(400).json({ error: 'Each division needs at least 4 players for playoffs' });
      }
      const a = aResult.rows;
      const b = bResult.rows;
      // The best four of each division advance: 1st of one division meets the
      // 4th of the other, 2nd meets the 3rd, and so on.
      const divisionQuarterFinals = [
        { player1: a[0].player_id, player2: b[3].player_id },
        { player1: a[1].player_id, player2: b[2].player_id },
        { player1: a[2].player_id, player2: b[1].player_id },
        { player1: a[3].player_id, player2: b[0].player_id },
      ];
      for (let i = 0; i < divisionQuarterFinals.length; i++) {
        const { player1, player2 } = divisionQuarterFinals[i];
        await queries.matches.insertSimple(pool, id, player1, player2, 'quarter_final', i + 1);
      }
      await queries.tournaments.updateStatus(pool, 'playoffs', id);
      return res.json({ message: 'Playoffs started' });
    }

    const standingsResult = await queries.stats.getTopN(pool, id, 8);
    if (standingsResult.rows.length < 8) {
      return res.status(400).json({ error: 'Need at least 8 players for playoffs' });
    }
    const players = standingsResult.rows;
    const playoffMatches = [
      { player1: players[0].player_id, player2: players[7].player_id },
      { player1: players[1].player_id, player2: players[6].player_id },
      { player1: players[2].player_id, player2: players[5].player_id },
      { player1: players[3].player_id, player2: players[4].player_id },
    ];
    for (let i = 0; i < playoffMatches.length; i++) {
      const { player1, player2 } = playoffMatches[i];
      await queries.matches.insertSimple(pool, id, player1, player2, 'quarter_final', i + 1);
    }
    await queries.tournaments.updateStatus(pool, 'playoffs', id);
    res.json({ message: 'Playoffs started' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/players/:id/stats', async (req, res) => {
  try {
    const result = await queries.stats.getPlayerStats(pool, req.params.id);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/stats/all-players', async (req, res) => {
  try {
    const result = await queries.stats.getAllPlayers(pool);
    const stats = result.rows.map((r) => {
      const matchesPlayed = r.matches_played;
      const framesWon = r.frames_won;
      const framesLost = r.frames_lost;
      return {
        ...r,
        match_win_pct: matchesPlayed > 0
          ? Math.round((r.matches_won / matchesPlayed) * 1000) / 10
          : 0,
        frame_win_pct: (framesWon + framesLost) > 0
          ? Math.round((framesWon / (framesWon + framesLost)) * 1000) / 10
          : 0,
      };
    });
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Initialize database and start server
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
