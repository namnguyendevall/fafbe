const express = require('express');
const router = express.Router();
const controller = require('./skill.controller');
const auth = require('../../middlewares/auth.middleware');


/**
 * @swagger
 * tags:
 *   name: Skills
 *   description: Job skills
 */

/**
 * @swagger
 * /api/skills:
 *   get:
 *     summary: List all skills
 *     tags: [Skills]
 *     responses:
 *       200:
 *         description: List of skills
 *   post:
 *     summary: Create a skill (Admin)
 *     tags: [Skills]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true

 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: Skill created
 */
const checkRole = require('../../middlewares/role.middleware');
const isAdmin = checkRole(['admin']);

// PUBLIC – FE dùng
router.get('/', controller.getAll);

// ADMIN
router.post('/', auth, isAdmin, controller.create);
router.put('/:id', auth, isAdmin, controller.update);
router.delete('/:id', auth, isAdmin, controller.deactivate);

module.exports = router;
