const express = require('express');
const auth = require('../middleware/auth.middleware');
const admin = require('../middleware/admin.middleware');
const gc = require('../controllers/game.controller');
const ac = require('../controllers/admin.controller');
const rc = require('../controllers/report.controller');
const fc = require('../controllers/feedback.controller');

const gameRouter = express.Router();
gameRouter.get('/history', auth, gc.getMatchHistory);
gameRouter.get('/leaderboard', auth, gc.getLeaderboard);
gameRouter.get('/match/:id', auth, gc.getMatchById);

const adminRouter = express.Router();
adminRouter.get('/dashboard', admin, ac.getDashboard);
adminRouter.get('/users', admin, ac.getUsers);
adminRouter.put('/users/:id/status', admin, ac.updateUserStatus);
adminRouter.get('/kyc', admin, ac.getPendingKYC);
adminRouter.put('/kyc/:id', admin, ac.reviewKYC);
adminRouter.get('/withdrawals', admin, ac.getWithdrawRequests);
adminRouter.put('/withdrawals/:id', admin, ac.processWithdraw);
adminRouter.post('/tournaments', admin, ac.createTournament);
adminRouter.get('/tournaments', admin, ac.getAllTournaments);
adminRouter.put('/tournaments/:id/cancel', admin, ac.cancelTournament);
adminRouter.get('/matches/live', admin, ac.getLiveMatches);
adminRouter.get('/transactions', admin, ac.getAllTransactions);
adminRouter.get('/reports', admin, rc.getAllReports);
adminRouter.put('/reports/:id', admin, rc.updateReportStatus);
adminRouter.get('/feedbacks', admin, fc.getFeedbacks);

module.exports = { gameRouter, adminRouter };
