const multer = require('multer');

// Use memory storage — file bytes will be in req.file.buffer
// We then stream to Cloudinary in the controller
const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            const err = new Error('Only image files are allowed');
            err.status = 400;
            cb(err, false);
        }
    },
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

module.exports = upload;
