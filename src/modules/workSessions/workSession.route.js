// src/modules/workSessions/workSession.route.js
const express = require('express');
const router = express.Router();
const auth = require('../../middlewares/auth.middleware');
const { checkIn, checkOut, getSessions } = require('./workSession.controller');

// GET  /api/work-sessions/:checkpointId        → get sessions + active session
// POST /api/work-sessions/:checkpointId/checkin  → start session
// POST /api/work-sessions/:checkpointId/checkout → end session
router.get('/:checkpointId', auth, getSessions);
router.post('/:checkpointId/checkin', auth, checkIn);
router.post('/:checkpointId/checkout', auth, checkOut);

module.exports = router;
