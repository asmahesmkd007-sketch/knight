const express = require('express');
const records = require('../middleware/records.middleware');
const ac = require('../controllers/records.controller');
const rc = require('../controllers/report.controller');
const fc = require('../controllers/feedback.controller');

const recordsRouter = express.Router();

recordsRouter.get('/dashboard', records, ac.getDashboard);
recordsRouter.get('/users', records, ac.getUsers);
recordsRouter.put('/users/:id/status', records, ac.updateUserStatus);
recordsRouter.get('/kyc', records, ac.getPendingKYC);
recordsRouter.put('/kyc/:id', records, ac.reviewKYC);
recordsRouter.get('/withdrawals', records, ac.getWithdrawRequests);
recordsRouter.put('/withdrawals/:id', records, ac.processWithdraw);
recordsRouter.post('/tournaments', records, ac.createTournament);
recordsRouter.get('/tournaments', records, ac.getAllTournaments);
recordsRouter.get('/tournaments/:id/details', records, ac.getTournamentDetails);
recordsRouter.put('/tournaments/:id/cancel', records, ac.cancelTournament);
recordsRouter.get('/matches/live', records, ac.getLiveMatches);
recordsRouter.get('/transactions', records, ac.getAllTransactions);
recordsRouter.get('/reports', records, rc.getAllReports);
recordsRouter.put('/reports/:id', records, rc.updateReportStatus);
recordsRouter.get('/feedbacks', records, fc.getFeedbacks);

module.exports = recordsRouter;
