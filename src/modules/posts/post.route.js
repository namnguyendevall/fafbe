const r = require('express').Router();
const c = require('./post.controller');
const auth = require('../../middlewares/auth.middleware');
const upload = require('../../middlewares/upload.middleware');

/**
 * @swagger
 * tags:
 *   name: Posts
 *   description: Social Feed API
 */

/**
 * @swagger
 * /api/posts:
 *   get:
 *     summary: Get social feed
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *   post:
 *     summary: Create a new post (supports multipart/form-data for images)
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 */
r.get('/', auth, c.getFeed);
r.post('/', auth, upload.single('image'), c.createPost);

/**
 * @swagger
 * /api/posts/user/{userId}:
 *   get:
 *     summary: Get posts by a specific user
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 */
r.get('/user/:userId', auth, c.getPostsByUser);

/**
 * @swagger
 * /api/posts/{id}/like:
 *   post:
 *     summary: Toggle like on a post
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 */
r.post('/:id/like', auth, c.toggleLike);

/**
 * @swagger
 * /api/posts/{id}/comments:
 *   get:
 *     summary: Get comments for a post
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *   post:
 *     summary: Add a comment to a post
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 */
r.get('/:id/comments', auth, c.getComments);
r.post('/:id/comments', auth, c.addComment);

// Delete a post (owner only)
r.delete('/:id', auth, c.deletePost);

// Update a post (owner only, supports optional image replacement)
r.put('/:id', auth, upload.single('image'), c.updatePost);

module.exports = r;
