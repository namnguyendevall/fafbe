// src/modules/category/cate.route.js
const express = require('express');
const router = express.Router();
const cateController = require('./cate.controller');
const authMiddleware = require('../../middlewares/auth.middleware');


/**
 * @swagger
 * tags:
 *   name: Categories
 *   description: Job categories
 */

/**
 * @swagger
 * /api/categories:
 *   get:
 *     summary: List all categories
 *     tags: [Categories]
 *     responses:
 *       200:
 *         description: List of categories
 *   post:
 *     summary: Create a category (Admin)
 *     tags: [Categories]
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
 *               - slug
 *             properties:
 *               name:
 *                 type: string
 *               slug:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Category created
 */
const checkRole = require('../../middlewares/role.middleware');
const isAdmin = checkRole(['admin']);

// Public – FE load dropdown
router.get('/', cateController.listCategories);

// User proposal
router.post('/proposals', authMiddleware, cateController.proposeCategory);

// Admin only
router.post('/', authMiddleware, isAdmin, cateController.createCategory);

module.exports = router;
