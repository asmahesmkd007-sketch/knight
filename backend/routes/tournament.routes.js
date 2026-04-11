const express = require('express');
const auth = require('../middleware/auth.middleware');
const tc = require('../controllers/tournament.controller');
const r = express.Router();
r.get('/', auth, tc.getTournaments);
r.get('/:id', auth, tc.getTournamentById);
r.post('/:id/join', auth, tc.joinTournament);
r.get('/:id/leaderboard', auth, tc.getLeaderboard);
module.exports = r;
