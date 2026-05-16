const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth.middleware');
const wc = require('../controllers/wallet.controller');

router.get('/balance',          auth, wc.getWallet);
router.post('/deposit/order',   auth, wc.createDepositOrder);
router.post('/deposit/verify',  auth, wc.verifyDeposit);
router.post('/withdraw',        auth, wc.requestWithdraw);
router.get('/transactions',     auth, wc.getTransactions);

module.exports = router;
