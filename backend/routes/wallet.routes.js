// wallet.routes.js
const express = require('express');
const auth = require('../middleware/auth.middleware');
const wc = require('../controllers/wallet.controller');
const wr = express.Router();
wr.get('/balance', auth, wc.getWallet);
wr.post('/deposit/create-order', auth, wc.createDepositOrder);
wr.post('/deposit/verify', auth, wc.verifyDeposit);
wr.post('/withdraw', auth, wc.requestWithdraw);
wr.get('/transactions', auth, wc.getTransactions);
module.exports = wr;
