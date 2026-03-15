const postService = require('./post.service');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary from CLOUDINARY_URL env var
if (process.env.CLOUDINARY_URL) {
    const url = new URL(process.env.CLOUDINARY_URL);
    cloudinary.config({
        cloud_name: url.hostname,
        api_key:    url.username,
        api_secret: url.password,
    });
}

/** Upload a buffer to Cloudinary and return the secure URL */
const uploadToCloudinary = (buffer, folder = 'faf/posts') => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder, resource_type: 'image', transformation: [{ width: 1200, quality: 'auto:good', crop: 'limit' }] },
            (error, result) => {
                if (error) return reject(error);
                resolve(result.secure_url);
            }
        );
        stream.end(buffer);
    });
};

const createPost = async (req, res, next) => {
    try {
        const { content } = req.body;
        console.log(`>>> [createPost] User: ${req.user?.id}, Content length: ${content?.length}`);
        
        let imageUrl = req.body.imageUrl || null;

        if (req.file && req.file.buffer) {
            console.log(`[createPost] File found, size: ${req.file.size} bytes. Uploading to Cloudinary...`);
            imageUrl = await uploadToCloudinary(req.file.buffer);
            console.log(`[createPost] Cloudinary SUCCESS: ${imageUrl}`);
        } else {
            console.log(`[createPost] No file attachment found.`);
        }

        console.log(`[createPost] Calling postService.createPost...`);
        const post = await postService.createPost(req.user.id, content, imageUrl);
        console.log(`[createPost] SUCCESS: Post created with ID: ${post.id}`);
        
        res.status(201).json({ message: 'Post created successfully', data: post });
    } catch (error) {
        console.error('[createPost] FATAL ERROR:', error.message);
        console.error('[createPost] Stack:', error.stack);
        next(error);
    }
};


const getFeed = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const posts = await postService.getFeed(req.user.id, page, limit);
        res.status(200).json({ data: posts });
    } catch (error) {
        console.error('[getFeed] Error:', error.message);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};

const getPostsByUser = async (req, res, next) => {
    try {
        const userId = req.params.userId;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        // user.id is the viewer's ID (for liked status)
        const viewerId = req.user ? req.user.id : null; // allow guests if we want, but currently protected wrapper requires auth
        
        const posts = await postService.getPostsByUser(userId, viewerId, page, limit);
        res.status(200).json({ data: posts });
    } catch (error) {
        next(error);
    }
};

const toggleLike = async (req, res, next) => {
    try {
        const result = await postService.toggleLike(req.params.id, req.user.id);
        res.status(200).json({ message: 'Like toggled', data: result });
    } catch (error) {
        next(error);
    }
};

const addComment = async (req, res, next) => {
    try {
        const { content } = req.body;
        const comment = await postService.addComment(req.params.id, req.user.id, content);
        res.status(201).json({ message: 'Comment added', data: comment });
    } catch (error) {
        next(error);
    }
};

const getComments = async (req, res, next) => {
    try {
        const comments = await postService.getComments(req.params.id);
        res.status(200).json({ data: comments });
    } catch (error) {
        next(error);
    }
};

const deletePost = async (req, res, next) => {
    try {
        await postService.deletePost(req.params.id, req.user.id);
        res.status(200).json({ message: 'Post deleted successfully' });
    } catch (error) {
        if (error.message === 'Forbidden') return res.status(403).json({ message: 'Not authorized' });
        if (error.message === 'Post not found') return res.status(404).json({ message: 'Post not found' });
        next(error);
    }
};

const updatePost = async (req, res, next) => {
    try {
        const { content } = req.body;
        let imageUrl = req.body.imageUrl || null;
        if (req.file && req.file.buffer) {
            imageUrl = await uploadToCloudinary(req.file.buffer);
        }
        const post = await postService.updatePost(req.params.id, req.user.id, content, imageUrl);
        res.status(200).json({ message: 'Post updated', data: post });
    } catch (error) {
        if (error.message === 'Forbidden') return res.status(403).json({ message: 'Not authorized' });
        if (error.message === 'Post not found') return res.status(404).json({ message: 'Post not found' });
        next(error);
    }
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
