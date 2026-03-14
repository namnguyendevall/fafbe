const express = require('express');
const router = express.Router();
const controller = require('./matching.controller');
const auth = require('../../middlewares/auth.middleware');


/**
 * @swagger
 * tags:
 *   name: Matching
 *   description: Job/Worker recommendations
 */

/**
 * @swagger
 * /api/matching/jobs/recommended:
 *   get:
 *     summary: Get recommended jobs for worker
 *     tags: [Matching]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of recommended jobs
 */
// Get recommended jobs for worker
router.get('/jobs/recommended', auth, controller.getRecommendedJobs);

/**
 * @swagger
 * /api/matching/workers/{jobId}:
 *   get:
 *     summary: Get recommended workers for a job
 *     tags: [Matching]
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of recommended workers
 */
// Get recommended workers for a job
router.get('/workers/:jobId', auth, controller.getRecommendedWorkers);

/**
 * @swagger
 * /api/matching/ai-recommendations/{jobId}:
 *   get:
 *     summary: Get exact AI semantic match score for a job posting
 *     tags: [Matching]
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Match Score computed
 */
router.get('/ai-recommendations/:jobId', auth, controller.getAIRecommendations);

module.exports = router;
