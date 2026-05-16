const express = require('express');
const auth = require('../middleware/auth.middleware');
const tc = require('../controllers/tournament.controller');
const rateLimit = require('express-rate-limit');

const r = express.Router();

const joinLimiter = rateLimit({
  windowMs: 10000,
  max: 5,
  message: { success: false, message: 'Too many join requests. Please wait 10 seconds.' }
});

r.get('/', auth, tc.getTournaments);
r.get('/:id', auth, tc.getTournamentById);
r.post('/:id/join', auth, joinLimiter, tc.joinTournament);
r.get('/:id/leaderboard', auth, tc.getLeaderboard);
module.exports = r;
