const express = require('express');
const router = express.Router();
const roomController = require('../controllers/room.controller');
const auth = require('../middleware/auth.middleware');

router.post('/create', auth, roomController.createRoom);
router.get('/code/:code', roomController.getRoomByCode);

module.exports = router;
