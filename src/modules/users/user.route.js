const r = require('express').Router();
const c = require('./user.controller');
const auth = require('../../middlewares/auth.middleware');
const role = require('../../middlewares/role.middleware');


/**
 * @swagger
 * tags:
 *   name: Users
 *   description: User management
 */

/**
 * @swagger
 * /api/users/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile
 *   put:
 *     summary: Update current user profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *               bio:
 *                 type: string
 *               hourlyRate:
 *                 type: number
 *     responses:
 *       200:
 *         description: Profile updated
 */
r.get('/me', auth, c.me);
r.put('/me', auth, c.updateMe);
r.delete('/me', auth, c.deleteAccount);

/**
 * @swagger
 * /api/users/featured:
 *   get:
 *     summary: Get featured workers
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of featured workers
 */
r.get('/featured', auth, c.getFeaturedWorkers);

/**
 * @swagger
 * /api/users/top-talents:
 *   get:
 *     summary: Get top 10 talents (highest rating & earnings)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: List of top talents
 */
r.get('/top-talents', auth, c.getTopTalents);

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Get public profile of a user
 *     tags: [Users]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: User public profile
 */
r.get('/:id', auth, c.getPublicProfile);

/**
 * @swagger
 * /api/users/{id}:
 *   delete:
 *     summary: Delete a user account (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 */
r.delete('/:id', auth, role(['admin']), c.deleteUserByAdmin);

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: List all users (Admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: List of users
 */
// admin only
r.get('/', auth, role(['admin']), c.listUsers);

/**
 * @swagger
 * /api/users/profile/portfolio/{userId}:
 *   get:
 *     summary: Get user portfolio
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Portfolio data
 */
r.get('/profile/portfolio/:userId', auth, c.getPortfolio);

/**
 * @swagger
 * /api/users/profile/portfolio:
 *   put:
 *     summary: Update current user portfolio
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               portfolio:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     title: { type: string }
 *                     url: { type: string }
 *                     description: { type: string }
 *     responses:
 *       200:
 *         description: Portfolio updated
 */
r.put('/profile/portfolio', auth, c.updatePortfolio);

/**
 * @swagger
 * /api/users/{id}/follow:
 *   post:
 *     summary: Follow a user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *   delete:
 *     summary: Unfollow a user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 */
/**
 * @swagger
 * /api/users/{id}/follow-status:
 *   get:
 *     summary: Check if current user is following this user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: "returns json {is_following: true/false}"
 */
r.get('/:id/follow-status', auth, c.checkFollowStatus);

r.post('/:id/follow', auth, c.followUser);
r.delete('/:id/follow', auth, c.unfollowUser);

module.exports = r;

