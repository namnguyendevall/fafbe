// src/modules/jobs/job.route.js
const express = require('express');
const router = express.Router();

const authMiddleware = require('../../middlewares/auth.middleware'); // chỉnh đúng path file
const { createJob, getListJobs, getJob, getMyJobs, updateJobHandler, deleteJobHandler, getAdminPendingJobs, reviewJobHandler, renewJobHandler } = require('./job.controller');

router.patch('/:id/renew', authMiddleware, renewJobHandler);


/**
 * @swagger
 * /api/jobs/my:
 *   get:
 *     summary: Get my job history (posted for employers, hired for workers)
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Job status (default ALL)
 *     responses:
 *       200:
 *         description: List of my jobs
 */
router.get('/my', authMiddleware, getMyJobs);
router.post('/', authMiddleware, createJob);
router.get('/', authMiddleware, getListJobs);

/**
 * @swagger
 * /api/jobs/admin/pending:
 *   get:
 *     summary: Get all pending jobs for moderation (Admin/Manager only)
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 */
router.get('/admin/pending', authMiddleware, getAdminPendingJobs);

/**
 * @swagger
 * /api/jobs/{id}/review:
 *   patch:
 *     summary: Review a job (Approve/Reject) (Admin/Manager only)
 *     tags: [Jobs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 */
router.patch('/:id/review', authMiddleware, reviewJobHandler);

/**
 * @swagger
 * /api/jobs/{id}:
 *   get:
 *     summary: Get job details
 *     tags: [Jobs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Job details
 *       404:
 *         description: Job not found
 */
router.get('/:id', authMiddleware, getJob);

router.put('/:id', authMiddleware, updateJobHandler);
router.delete('/:id', authMiddleware, deleteJobHandler);

module.exports = router;