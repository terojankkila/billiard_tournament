import axios from 'axios'

const API = axios.create({ baseURL: '/api' })

// Shared secret proving the request comes from this frontend bundle.
// Baked in at build time from VITE_APP_KEY; must match backend FRONTEND_KEY.
const APP_KEY = import.meta.env.VITE_APP_KEY || 'dev-frontend-key'

// The tournament currently being viewed. Its access token (obtained after the
// password prompt) is attached to requests for password-protected endpoints.
let activeTournamentId = null
export const setActiveTournament = (id) => { activeTournamentId = id }

API.interceptors.request.use((config) => {
  config.headers['X-App-Key'] = APP_KEY
  const adminToken = localStorage.getItem('admin_token')
  if (adminToken) {
    config.headers.Authorization = `Bearer ${adminToken}`
  }
  if (activeTournamentId) {
    const tournamentToken = localStorage.getItem(`tournament_token_${activeTournamentId}`)
    if (tournamentToken) {
      config.headers['X-Tournament-Token'] = tournamentToken
    }
  }
  return config
})

export const authService = {
  login: (username, password) => API.post('/auth/login', { username, password }),
  me: () => API.get('/auth/me'),
  changePassword: (current_password, new_password) => API.put('/auth/password', { current_password, new_password }),
}

export const adminService = {
  list: () => API.get('/admin/admins'),
  create: (username, password) => API.post('/admin/admins', { username, password }),
  remove: (id) => API.delete(`/admin/admins/${id}`),
}

export const tournamentService = {
  getAll: () => API.get('/tournaments'),
  getById: (id) => API.get(`/tournaments/${id}`),
  create: (data) => API.post('/tournaments', data),
  verifyPassword: (id, password) => API.post(`/tournaments/${id}/verify`, { password }),
  getPlayers: (id) => API.get(`/tournaments/${id}/players`),
  addPlayers: (id, playerIds) => API.post(`/tournaments/${id}/players`, { playerIds }),
  previewDivisions: (id) => API.post(`/tournaments/${id}/divisions/preview`),
  saveDivisions: (id, assignments) => API.put(`/tournaments/${id}/divisions`, { assignments }),
  start: (id) => API.post(`/tournaments/${id}/start`),
  startPlayoffs: (id) => API.post(`/tournaments/${id}/playoffs`),
  getMatches: (id) => API.get(`/tournaments/${id}/matches`),
  getStandings: (id) => API.get(`/tournaments/${id}/standings`),
}

export const playerService = {
  getAll: () => API.get('/players'),
  create: (data) => API.post('/players', data),
  getStats: (id) => API.get(`/players/${id}/stats`),
  getAllStats: () => API.get('/stats/all-players'),
}

export const matchService = {
  updateResult: (id, data) => API.put(`/matches/${id}`, data),
  getFrames: (id) => API.get(`/matches/${id}/frames`),
  addFrame: (id, data) => API.post(`/matches/${id}/frames`, data),
  deleteFrame: (id, frameNumber) => API.delete(`/matches/${id}/frames/${frameNumber}`),
  start: (id) => API.post(`/matches/${id}/start`),
}
