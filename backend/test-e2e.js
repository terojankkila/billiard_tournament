const API = 'http://localhost:3001/api';
const BASE = API;

const APP_KEY = 'dev-frontend-key';

let TOKEN = null;
let T_TOKEN = null;

// Tournaments/matches are password-protected: the helper automatically attaches
// the tournament access token (obtained via /verify) to those routes.
const needsTournamentToken = (path) => /^\/(tournaments\/\d|matches\/)/.test(path);

async function request(path, method = 'GET', body = null, opts = {}) {
  if (typeof opts === 'boolean') opts = { useAdmin: opts };
  const headers = { 'Content-Type': 'application/json', 'X-App-Key': APP_KEY };
  if (opts.useAdmin !== false && TOKEN) headers.Authorization = `Bearer ${TOKEN}`;
  if (opts.useTournament !== false && needsTournamentToken(path) && T_TOKEN) headers['X-Tournament-Token'] = T_TOKEN;
  const fetchOpts = { method, headers };
  if (body) fetchOpts.body = JSON.stringify(body);
  const res = await fetch(BASE + path, fetchOpts);
  const data = await res.json();
  if (!res.ok) throw new Error(`${method} ${path}: ${JSON.stringify(data)}`);
  return data;
}

async function run() {
  // --- Admin auth tests ---
  // Login with default admin
  const login = await request('/auth/login', 'POST', { username: 'admin', password: 'admin123' }, { useAdmin: false });
  TOKEN = login.token;
  console.log('Admin login OK:', login.admin.username);

  // Verify /me
  const me = await request('/auth/me');
  if (me.username !== 'admin') throw new Error('/me returned wrong admin');
  console.log('/me OK');

  // Verify tournament creation is blocked without a token
  try {
    await request('/tournaments', 'POST', { name: 'No Auth', password: 'x' }, { useAdmin: false });
    throw new Error('Tournament creation without auth should have failed');
  } catch (e) {
    if (!/401|Authentication required/.test(JSON.stringify(e.message))) throw e;
    console.log('Unauthenticated tournament creation blocked OK');
  }

  // Admin management: create a second admin, list, change own password
  await request('/admin/admins', 'POST', { username: 'admin2', password: 'pw2' });
  const admins = await request('/admin/admins');
  console.log('Admins listed:', admins.map(a => a.username).join(', '));
  if (!admins.some(a => a.username === 'admin2')) throw new Error('admin2 not created');
  await request('/auth/password', 'PUT', { current_password: 'admin123', new_password: 'newpass1' });
  // Re-login with new password
  const login2 = await request('/auth/login', 'POST', { username: 'admin', password: 'newpass1' }, { useAdmin: false });
  TOKEN = login2.token;
  console.log('Password change + re-login OK');
  // Login as second admin and delete it (cleanup via admin1)
  const loginAdmin2 = await request('/auth/login', 'POST', { username: 'admin2', password: 'pw2' }, { useAdmin: false });
  TOKEN = loginAdmin2.token;
  // admin2 cannot delete itself
  try {
    await request(`/admin/admins/${admins.find(a => a.username === 'admin2').id}`, 'DELETE');
    throw new Error('Deleting own account should have failed');
  } catch (e) {
    console.log('Self-delete blocked OK');
  }
  // Switch back to admin
  TOKEN = login2.token;
  await request(`/admin/admins/${admins.find(a => a.username === 'admin2').id}`, 'DELETE');
  console.log('Admin2 deleted OK');

  // Restore the original admin password so the test is idempotent
  await request('/auth/password', 'PUT', { current_password: 'newpass1', new_password: 'admin123' });
  const loginBack = await request('/auth/login', 'POST', { username: 'admin', password: 'admin123' }, { useAdmin: false });
  TOKEN = loginBack.token;
  console.log('Admin password restored OK');

  // Create tournament (as authenticated admin)
  const tourney = await request('/tournaments', 'POST', { name: 'E2E Test', password: 'pass123' });
  console.log('Created tournament:', tourney.id);

  // --- Frontend-origin + tournament access guards ---

  // Requests without the frontend app key must be rejected
  {
    const res = await fetch(BASE + '/tournaments', { headers: { 'Content-Type': 'application/json' } });
    if (res.status === 403) console.log('No app key blocked OK');
    else throw new Error(`Expected 403 without X-App-Key, got ${res.status}`);
  }
  {
    const res = await fetch(BASE + '/tournaments', { headers: { 'Content-Type': 'application/json', 'X-App-Key': 'wrong-key' } });
    if (res.status === 403) console.log('Wrong app key blocked OK');
    else throw new Error(`Expected 403 with wrong X-App-Key, got ${res.status}`);
  }

  // Tournament views (standings, matches, players) are PUBLIC — no token needed.
  {
    const res = await fetch(BASE + `/tournaments/${tourney.id}/standings`, {
      headers: { 'Content-Type': 'application/json', 'X-App-Key': APP_KEY },
    });
    if (res.status === 200) console.log('Standings publicly viewable OK');
    else throw new Error(`Expected 200 for public standings, got ${res.status}`);
  }
  // Score-editing (start) requires authentication
  try {
    await request(`/tournaments/${tourney.id}/start`, 'POST', null, { useAdmin: false, useTournament: false });
    throw new Error('Start without tournament token or admin should have failed');
  } catch (e) {
    if (!/Authentication required/.test(JSON.stringify(e.message))) throw e;
    console.log('Start blocked without auth OK');
  }

  // An admin token alone grants edit access (admins can always score).
  // Verified here against the players route to avoid double-starting.
  await request(`/tournaments/${tourney.id}/players`, 'POST', { playerIds: [] }, { useTournament: false, useAdmin: true });
  console.log('Admin can edit tournament without tournament token OK');

  // Wrong-password verify must fail and issue no token
  try {
    await request(`/tournaments/${tourney.id}/verify`, 'POST', { password: 'wrong' }, { useAdmin: false });
    throw new Error('Verify with wrong password should have failed');
  } catch (e) {
    if (!/Invalid password/.test(JSON.stringify(e.message))) throw e;
    console.log('Invalid tournament password blocked OK');
  }

  // Correct password issues a tournament access token
  const verified = await request(`/tournaments/${tourney.id}/verify`, 'POST', { password: 'pass123' }, { useAdmin: false });
  if (!verified.valid || !verified.token) throw new Error('Verify did not return a token');
  T_TOKEN = verified.token;
  console.log('Tournament password verified, access token issued OK');

  // A tournament token only unlocks editing for its own tournament, not another.
  const other = await request('/tournaments', 'POST', { name: 'No Access', password: 'x' });
  try {
    await request(`/tournaments/${other.id}/start`, 'POST', null, { useAdmin: false });
    throw new Error('Cross-tournament edit access should have failed');
  } catch (e) {
    if (!/do not have access/.test(JSON.stringify(e.message))) throw e;
    console.log('Cross-tournament edit access blocked OK');
  }

  // Create 8 players
  const names = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'];
  const playerIds = [];
  for (const n of names) {
    const p = await request('/players', 'POST', { name: n });
    playerIds.push(p.id);
  }
  console.log('Created players:', playerIds);

  // Add players
  await request(`/tournaments/${tourney.id}/players`, 'POST', { playerIds });
  console.log('Players added');

  // Start tournament
  await request(`/tournaments/${tourney.id}/start`, 'POST');
  const matches = await request(`/tournaments/${tourney.id}/matches`);
  const rr = matches.filter(m => m.round === 'round_robin');
  console.log('Round robin matches:', rr.length, '(expected 28)');
  if (rr.length !== 28) throw new Error('Expected 28 round-robin matches for 8 players');

  // Verify round structure: 7 rounds of 4 matches, each player exactly once per round
  const rounds = [...new Set(rr.map(m => m.round_number))].sort((a, b) => a - b);
  console.log('Rounds:', rounds.join(','), '(expected 1-7)');
  if (rounds.length !== 7 || rounds[0] !== 1 || rounds[6] !== 7) {
    throw new Error('Expected 7 rounds numbered 1-7');
  }

  for (let r = 1; r <= 7; r++) {
    const roundMatches = rr.filter(m => m.round_number === r);
    if (roundMatches.length !== 4) throw new Error(`Round ${r}: expected 4 matches, got ${roundMatches.length}`);
    const playedSet = new Set();
    for (const m of roundMatches) {
      for (const pid of [m.player1_id, m.player2_id]) {
        if (playedSet.has(pid)) throw new Error(`Round ${r}: player ${pid} plays twice`);
        playedSet.add(pid);
      }
    }
    if (playedSet.size !== 8) throw new Error(`Round ${r}: expected 8 unique players, got ${playedSet.size}`);
  }
  console.log('Round structure verified: 7 rounds x 4 matches, every player once per round');

  // Test round-start rules on a fresh tournament state
  const matchDetails = await request(`/tournaments/${tourney.id}/matches`);
  const rrStart = matchDetails.filter(m => m.round === 'round_robin');
  const round1M = rrStart.find(m => m.round_number === 1);
  const round2M = rrStart.find(m => m.round_number === 2);

  // Cannot add frames before starting
  try {
    await request(`/matches/${round1M.id}/frames`, 'POST', { frame_number: 1, winner_id: round1M.player1_id });
    throw new Error('Adding frames to unstarted match should have failed');
  } catch (e) {
    if (!/not been started/.test(JSON.stringify(e.message))) throw e;
    console.log('Frames blocked before start OK');
  }

  // Round 2 match cannot be started (round 1 is current)
  try {
    await request(`/matches/${round2M.id}/start`, 'POST');
    throw new Error('Starting a non-current-round match should have failed');
  } catch (e) {
    if (!/current round/.test(JSON.stringify(e.message))) throw e;
    console.log('Non-current-round start blocked OK');
  }

  // Start a round 1 match
  await request(`/matches/${round1M.id}/start`, 'POST');
  console.log('Round 1 match started OK');

  // Per-frame entry + editing on the started round-1 match
  const editTest = round1M;
  // Add frame 1 won by p1, frame 2 won by p2
  await request(`/matches/${editTest.id}/frames`, 'POST', { frame_number: 1, winner_id: editTest.player1_id });
  await request(`/matches/${editTest.id}/frames`, 'POST', { frame_number: 2, winner_id: editTest.player2_id });
  let fs = await request(`/matches/${editTest.id}/frames`);
  console.log('Frames after adding 2:', fs.length, '(expected 2)');
  if (fs.length !== 2) throw new Error('Expected 2 frames');
  // Edit frame 1 by overwriting winner to p2 (fix error)
  await request(`/matches/${editTest.id}/frames`, 'POST', { frame_number: 1, winner_id: editTest.player2_id });
  fs = await request(`/matches/${editTest.id}/frames`);
  const f1 = fs.find(f => f.frame_number === 1);
  console.log('Frame 1 winner after edit is P2:', f1.winner_id === editTest.player2_id);
  if (f1.winner_id !== editTest.player2_id) throw new Error('Editing frame 1 failed');
  // Delete frame 2
  await request(`/matches/${editTest.id}/frames/2`, 'DELETE');
  fs = await request(`/matches/${editTest.id}/frames`);
  console.log('Frames after delete:', fs.length, '(expected 1)');
  if (fs.length !== 1) throw new Error('Expected 1 frame after delete');
  // Reset this test match back to completed via bulk PUT so standings stay correct
  await request(`/matches/${editTest.id}`, 'PUT', { frames: [{ winner_id: editTest.player1_id }, { winner_id: editTest.player1_id }, { winner_id: editTest.player1_id }] });
  console.log('Per-frame entry + edit verified');

  // Complete all remaining round robin matches using bulk PUT
  for (let i = 0; i < rr.length; i++) {
    const m = rr[i];
    // Build a best-of-5 winner list: play frames until someone reaches 3
    const frames = [];
    let p1 = 0, p2 = 0;
    for (let f = 0; f < 5; f++) {
      if (p1 === 3 || p2 === 3) break;
      if (Math.random() < 0.5) { frames.push({ winner_id: m.player1_id }); p1++; }
      else { frames.push({ winner_id: m.player2_id }); p2++; }
    }
    await request(`/matches/${m.id}`, 'PUT', { frames });
  }
  console.log('All round robin matches completed');

  // Verify standings
  const standings = await request(`/tournaments/${tourney.id}/standings`);
  console.log('Standings top 8:', standings.length);
  standings.forEach(s => console.log(`  #${s.rank} ${s.name}: ${s.total_points} pts`));

  // Start playoffs
  await request(`/tournaments/${tourney.id}/playoffs`, 'POST');
  let tMatches = await request(`/tournaments/${tourney.id}/matches`);
  let qf = tMatches.filter(m => m.round === 'quarter_final');
  console.log('Quarter finals created:', qf.length, '(expected 4)');
  if (qf.length !== 4) throw new Error('Expected 4 quarter final matches');

  // Complete quarter finals
  for (const m of qf) {
    const scores = [[3, 1], [3, 2], [3, 0], [2, 3]];
    // ensure valid: use alternating winners
    const p1Wins = m.match_order % 2 === 1;
    const p1Frames = p1Wins ? 3 : (m.match_order === 4 ? 2 : Math.floor(Math.random() * 2) + 1);
    const p2Frames = p1Wins ? (4 - p1Frames < 0 ? Math.floor(Math.random()*3) : 4 - p1Frames) : 3;
    const pr = await request(`/matches/${m.id}`, 'PUT', { player1_frames: p1Frames, player2_frames: p2Frames });
  }
  console.log('Quarter finals completed');

  // Check semi finals auto-created
  tMatches = await request(`/tournaments/${tourney.id}/matches`);
  let sf = tMatches.filter(m => m.round === 'semi_final');
  console.log('Semi finals created:', sf.length, '(expected 2)');
  if (sf.length !== 2) throw new Error('Expected 2 semi final matches');

  // Verify the bracket pairing: winner(1v8) vs winner(4v5), winner(2v7) vs winner(3v6)
  const qfDone = tMatches.filter(m => m.round === 'quarter_final');
  const qfWinner = qfDone.reduce((map, m) => { map[m.match_order] = m.winner_id; return map; }, {});
  const sfPlayerSets = sf.map(m => new Set([m.player1_id, m.player2_id]));
  const hasPair = (a, b) => sfPlayerSets.some(s => s.has(a) && s.has(b));
  if (!hasPair(qfWinner[1], qfWinner[4])) throw new Error('Semi finals: winner(1v8) should meet winner(4v5)');
  if (!hasPair(qfWinner[2], qfWinner[3])) throw new Error('Semi finals: winner(2v7) should meet winner(3v6)');
  console.log('Semi final pairing verified: (1v8) winner vs (4v5) winner, (2v7) winner vs (3v6) winner');

  // Complete semi finals
  for (const m of sf) {
    await request(`/matches/${m.id}`, 'PUT', { player1_frames: 3, player2_frames: 1 });
  }
  console.log('Semi finals completed');

  // Check final auto-created
  tMatches = await request(`/tournaments/${tourney.id}/matches`);
  let final = tMatches.filter(m => m.round === 'final');
  console.log('Final created:', final.length, '(expected 1)');
  if (final.length !== 1) throw new Error('Expected 1 final match');

  // Complete final
  await request(`/matches/${final[0].id}`, 'PUT', { player1_frames: 3, player2_frames: 2 });
  console.log('Final completed');

  // Verify tournament status
  const finalTourney = await request(`/tournaments/${tourney.id}`);
  console.log('Tournament status:', finalTourney.status, '(expected completed)');
  if (finalTourney.status !== 'completed') throw new Error('Tournament should be completed');

  // Verify champion
  const finalMatches = await request(`/tournaments/${tourney.id}/matches`);
  const finalMatch = finalMatches.find(m => m.round === 'final');
  console.log('Champion:', finalMatch.winner_name);

  // Verify all-players stats endpoint
  const allStats = await request('/stats/all-players', 'GET', null, { useAdmin: false });
  if (!Array.isArray(allStats) || allStats.length < 8) throw new Error('Expected at least 8 players in all-players stats');
  const statsShape = allStats[0];
  for (const key of ['name', 'matches_played', 'matches_won', 'frames_won', 'frames_lost', 'match_win_pct', 'frame_win_pct']) {
    if (!(key in statsShape)) throw new Error(`All-players stats missing key: ${key}`);
  }
  console.log('All-players stats:', allStats.length, 'players, top:', allStats[0].name, `${allStats[0].matches_won} wins, ${allStats[0].match_win_pct}% match win, ${allStats[0].frame_win_pct}% frame win`);

  console.log('\n✅ ALL E2E TESTS PASSED');
}

run().catch(err => { console.error('\n❌ TEST FAILED:', err.message); process.exit(1); });