const db = require('./post.sql');

const createPost = async (userId, content, imageUrl) => {
    if (!content && !imageUrl) {
        throw new Error('Content or image is required');
    }
    return await db.createPost(userId, content || '', imageUrl);

};

const getFeed = async (currentUserId, page = 1, limit = 20) => {
    const offset = (page - 1) * limit;
    return await db.getFeed(currentUserId, limit, offset);
};

const getPostsByUser = async (userId, currentUserId, page = 1, limit = 20) => {
    const offset = (page - 1) * limit;
    return await db.getPostsByUser(userId, currentUserId, limit, offset);
};

const toggleLike = async (postId, currentUserId) => {
    const post = await db.getPostById(postId, currentUserId);
    if (!post) throw new Error('Post not found');
    return await db.toggleLike(postId, currentUserId);
};

const addComment = async (postId, userId, content) => {
    if (!content) throw new Error('Comment content is required');
    const post = await db.getPostById(postId, userId);
    if (!post) throw new Error('Post not found');
    return await db.addComment(postId, userId, content);
};

const getComments = async (postId) => {
    return await db.getCommentsByPost(postId);
};

const deletePost = async (postId, userId) => {
    const post = await db.getPostById(postId, userId);
    if (!post) throw new Error('Post not found');
    if (post.user_id !== userId) throw new Error('Forbidden');
    const deleted = await db.deletePost(postId, userId);
    if (!deleted) throw new Error('Delete failed or not authorized');
    return deleted;
};

const updatePost = async (postId, userId, content, imageUrl) => {
    const post = await db.getPostById(postId, userId);
    if (!post) throw new Error('Post not found');
    if (post.user_id !== userId) throw new Error('Forbidden');
    if (!content && !imageUrl) throw new Error('Nothing to update');
    return await db.updatePost(postId, userId, content, imageUrl);
};

module.exports = {
    createPost,
    getFeed,
    getPostsByUser,
    toggleLike,
    addComment,
    getComments,
    deletePost,
    updatePost,
};
