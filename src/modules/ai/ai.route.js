const express = require('express');
const router = express.Router();
const multer = require('multer');
const aiController = require('./ai.controller');

// Configure multer for memory storage or temp file
const upload = multer({ dest: 'uploads/temp_audio/' });

// POST /api/ai/transcribe
// Accepts an audio/video file and returns a JSON array of captions
router.post('/transcribe', upload.single('file'), aiController.transcribeAudio);

module.exports = router;
