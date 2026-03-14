const db = require('../../config/database');

const createPost = async (userId, content, imageUrl) => {
    const query = `
        INSERT INTO posts (user_id, content, image_url)
        VALUES ($1, $2, $3)
        RETURNING *;
    `;
    const result = await db.query(query, [userId, content, imageUrl]);
    return result.rows[0];
};

const getFeed = async (currentUserId, limit = 20, offset = 0) => {
    // Basic feed: Returns latest posts from everyone, plus whether currentUser liked them, and counts.
    // If we wanted to limit to followers, we could add a JOIN on user_followers. For now, public feed like Dribbble/LinkedIn.
    const query = `
        SELECT 
            p.*,
            up.full_name as author_name,
            up.avatar_url as author_avatar,
            u.role as author_role,
            COUNT(DISTINCT l.user_id) as likes_count,
            COUNT(DISTINCT c.id) as comments_count,
            EXISTS(SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = $1) as is_liked_by_me
        FROM posts p
        JOIN users u ON p.user_id = u.id
        LEFT JOIN user_profiles up ON u.id = up.user_id
        LEFT JOIN post_likes l ON p.id = l.post_id
        LEFT JOIN post_comments c ON p.id = c.post_id
        GROUP BY p.id, p.user_id, p.content, p.image_url, p.created_at, p.updated_at, u.id, up.full_name, up.avatar_url
        ORDER BY p.created_at DESC
        LIMIT $2 OFFSET $3;
    `;
    const result = await db.query(query, [currentUserId, limit, offset]);
    return result.rows;
};

const getPostById = async (postId, currentUserId) => {
    const query = `
        SELECT 
            p.*,
            up.full_name as author_name,
            up.avatar_url as author_avatar,
            u.role as author_role,
            COUNT(DISTINCT l.user_id) as likes_count,
            COUNT(DISTINCT c.id) as comments_count,
            EXISTS(SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = $2) as is_liked_by_me
        FROM posts p
        JOIN users u ON p.user_id = u.id
        LEFT JOIN user_profiles up ON u.id = up.user_id
        LEFT JOIN post_likes l ON p.id = l.post_id
        LEFT JOIN post_comments c ON p.id = c.post_id
        WHERE p.id = $1
        GROUP BY p.id, p.user_id, p.content, p.image_url, p.created_at, p.updated_at, u.id, up.full_name, up.avatar_url;
    `;
    const result = await db.query(query, [postId, currentUserId]);
    return result.rows[0];
};

const getPostsByUser = async (userId, currentUserId, limit = 20, offset = 0) => {
    const query = `
        SELECT 
            p.*,
            up.full_name as author_name,
            up.avatar_url as author_avatar,
            u.role as author_role,
            COUNT(DISTINCT l.user_id) as likes_count,
            COUNT(DISTINCT c.id) as comments_count,
            EXISTS(SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = $2) as is_liked_by_me
        FROM posts p
        JOIN users u ON p.user_id = u.id
        LEFT JOIN user_profiles up ON u.id = up.user_id
        LEFT JOIN post_likes l ON p.id = l.post_id
        LEFT JOIN post_comments c ON p.id = c.post_id
        WHERE p.user_id = $1
        GROUP BY p.id, p.user_id, p.content, p.image_url, p.created_at, p.updated_at, u.id, up.full_name, up.avatar_url
        ORDER BY p.created_at DESC
        LIMIT $3 OFFSET $4;
    `;
    const result = await db.query(query, [userId, currentUserId, limit, offset]);
    return result.rows;
};

const toggleLike = async (postId, userId) => {
    // Check if like exists
    const checkQuery = `SELECT 1 FROM post_likes WHERE post_id = $1 AND user_id = $2`;
    const exist = await db.query(checkQuery, [postId, userId]);

    if (exist.rows.length > 0) {
        // Unlike
        const deleteQuery = `DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2 RETURNING *`;
        await db.query(deleteQuery, [postId, userId]);
        return { liked: false };
    } else {
        // Like
        const insertQuery = `INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2) RETURNING *`;
        await db.query(insertQuery, [postId, userId]);
        return { liked: true };
    }
};

const addComment = async (postId, userId, content) => {
    const query = `
        INSERT INTO post_comments (post_id, user_id, content)
        VALUES ($1, $2, $3)
        RETURNING *;
    `;
    const result = await db.query(query, [postId, userId, content]);
    return result.rows[0];
};

const getCommentsByPost = async (postId) => {
    const query = `
        SELECT c.*, up.full_name as author_name, up.avatar_url as author_avatar
        FROM post_comments c
        JOIN users u ON c.user_id = u.id
        LEFT JOIN user_profiles up ON u.id = up.user_id
        WHERE c.post_id = $1
        ORDER BY c.created_at ASC;
    `;
    const result = await db.query(query, [postId]);
    return result.rows;
};

const deletePost = async (postId, userId) => {
    const query = `
        DELETE FROM posts
        WHERE id = $1 AND user_id = $2
        RETURNING id;
    `;
    const result = await db.query(query, [postId, userId]);
    return result.rows[0]; // undefined if not owned by user
};

const updatePost = async (postId, userId, content, imageUrl) => {
    // Only update fields that are provided
    const query = `
        UPDATE posts
        SET
            content   = COALESCE($3, content),
            image_url = COALESCE($4, image_url),
            updated_at = NOW()
        WHERE id = $1 AND user_id = $2
        RETURNING *;
    `;
    const result = await db.query(query, [postId, userId, content || null, imageUrl || null]);
    return result.rows[0];
};

module.exports = {
    createPost,
    getFeed,
    getPostsByUser,
    getPostById,
    toggleLike,
    addComment,
    getCommentsByPost,
    deletePost,
    updatePost,
};
