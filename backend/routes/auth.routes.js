// ===== auth.routes.js =====
const express = require('express');
const router = express.Router();
const { register, login, logout, refreshToken, getMe, oauthLogin } = require('../controllers/auth.controller');
const auth = require('../middleware/auth.middleware');
router.post('/register', register);
router.post('/login', login);
router.post('/oauth-login', oauthLogin);
router.post('/logout', auth, logout);
router.post('/refresh', refreshToken);
router.get('/me', auth, getMe);
module.exports = router;
