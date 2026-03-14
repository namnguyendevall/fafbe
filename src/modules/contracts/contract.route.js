const express = require('express');
const router = express.Router();
const controller = require('./contract.controller');
const auth = require('../../middlewares/auth.middleware');


/**
 * @swagger
 * tags:
 *   name: Contracts
 *   description: Contract management
 */

/**
 * @swagger
 * /api/contracts/active/me:
 *   get:
 *     summary: Get worker's active contract
 *     tags: [Contracts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Active contract details
 */
router.get('/active/me', auth, controller.getMyActiveContract);

/**
 * @swagger
 * /api/contracts/my:
 *   get:
 *     summary: Get all my contracts
 *     tags: [Contracts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of contracts
 */
router.get('/my', auth, controller.getMyContracts);

/**
 * @swagger
 * /api/contracts/job/{jobId}:
 *   get:
 *     summary: Get contract by Job ID
 *     tags: [Contracts]
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Contract details
 */
router.get('/job/:jobId', auth, controller.getContractByJob);

/**
 * @swagger
 * /api/contracts/{id}:
 *   get:
 *     summary: Get contract details
 *     tags: [Contracts]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Contract details
 */
router.get('/:id', auth, controller.get);

/**
 * @swagger
 * /api/contracts/{id}/request-otp:
 *   post:
 *     summary: Request OTP to sign a contract
 *     tags: [Contracts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: OTP sent
 */
router.post('/:id/request-otp', auth, controller.requestSignOtp);

/**
 * @swagger
 * /api/contracts/{id}/sign:
 *   post:
 *     summary: Sign a contract
 *     tags: [Contracts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               otp:
 *                 type: string
 *     responses:
 *       200:
 *         description: Contract signed
 */
router.post('/:id/sign', auth, controller.sign);

/**
 * @swagger
 * /api/contracts/{id}/terminate:
 *   put:
 *     summary: Terminate a contract
 *     tags: [Contracts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Contract terminated
 */
router.put('/:id/terminate', auth, controller.terminateContract);

/**
 * @swagger
 * /api/contracts/{id}/settle-request:
 *   post:
 *     summary: Worker requests settlement for an active contract
 *     tags: [Contracts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Settlement requested
 */
router.post('/:id/settle-request', auth, controller.requestSettlement);

/**
 * @swagger
 * /api/contracts/{id}/finalize-settlement:
 *   post:
 *     summary: Client finalizes settlement
 *     tags: [Contracts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Contract settled and closed
 */
router.post('/:id/finalize-settlement', auth, controller.finalizeSettlement);


// ── Checkpoint actions (worker/employer) ──────────────────────────
// Worker submits work for a checkpoint
router.put('/checkpoints/:id/submit', auth, controller.submitCheckpoint);

// Employer approves a submitted checkpoint
router.put('/checkpoints/:id/approve', auth, controller.approveCheckpoint);

// Employer rejects a submitted checkpoint
router.put('/checkpoints/:id/reject', auth, controller.rejectCheckpoint);

module.exports = router;
