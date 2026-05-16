const express = require('express');
const auth = require('../middleware/auth.middleware');
const cc = require('../controllers/clan.controller');
const r = express.Router();

// ─── WAR MANAGEMENT (static paths first — must precede /:id) ─
r.post('/wars/declare',        auth, cc.declareWar);
r.get('/wars/me',              auth, cc.getMyWar);
r.get('/wars/pending',         auth, cc.getPendingWars);
r.get('/wars/history',         auth, cc.getWarHistory);
r.put('/wars/:warId/accept',   auth, cc.acceptWar);
r.post('/wars/lineup',         auth, cc.selectWarLineup);
r.get('/wars/:warId',          auth, cc.getWarDetails);

// ─── CLAN MANAGEMENT (static paths first — must precede /:id) ─
r.post('/',                    auth, cc.createClan);
r.get('/me',                   auth, cc.getMyClan);
r.get('/search',               auth, cc.searchClans);
r.get('/leaderboard',          auth, cc.getClanLeaderboard);
r.post('/leave',               auth, cc.leaveClan);
r.put('/members/role',         auth, cc.updateMemberRole);
r.delete('/members/:userId',   auth, cc.kickMember);
r.get('/requests',             auth, cc.getJoinRequests);
r.post('/requests/respond',    auth, cc.respondJoinRequest);
r.delete('/',                  auth, cc.deleteClan);
r.put('/transfer-leadership',  auth, cc.transferLeadership);
r.post('/invite',              auth, cc.inviteMember);
r.get('/my-invitations',       auth, cc.getMyInvitations);
r.post('/respond-invitation',  auth, cc.respondInvitation);

// ─── Dynamic clan routes (after all static paths) ────────────
r.get('/:id',                  auth, cc.getClanById);
r.post('/:id/join',            auth, cc.joinClan);

module.exports = r;
