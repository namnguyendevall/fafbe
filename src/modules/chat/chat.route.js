const express = require('express');
const router = express.Router();
const controller = require('./chat.controller');
const auth = require('../../middlewares/auth.middleware');


/**
 * @swagger
 * tags:
 *   name: Chat
 *   description: Real-time messaging
 */

/**
 * @swagger
 * /api/chat/conversations:
 *   get:
 *     summary: List my conversations
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of conversations
 */
router.get('/conversations', auth, controller.getConversations);

/**
 * @swagger
 * /api/chat/{id}/messages:
 *   get:
 *     summary: Get messages for a conversation
 *     tags: [Chat]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Message history
 */
router.get('/:id/messages', auth, controller.getMessages);

/**
 * @swagger
 * /api/chat/start:
 *   post:
 *     summary: Start a new conversation
 *     tags: [Chat]

 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - otherUserId
 *             properties:
 *               otherUserId:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Conversation started
 */
router.post('/start', auth, controller.startChat);

/**
 * @swagger
 * /api/chat/{id}/messages:
 *   post:
 *     summary: Send a message via HTTP
 *     tags: [Chat]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 */
router.post('/:id/messages', auth, controller.sendMessage);

module.exports = router;
