const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// Configure Cloudinary if URL is provided in .env
if (process.env.CLOUDINARY_URL) {
    cloudinary.config(); 
}

const uploadToCloudinary = (buffer, folder = 'faf_submissions') => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder: folder,
                resource_type: "auto"
            },
            (error, result) => {
                if (error) return reject(error);
                resolve(result.secure_url);
            }
        );
        stream.end(buffer);
    });
};

// POST /api/uploads/submission — no auth required (open endpoint)
router.post('/submission', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'Không có file' });

    try {
        let url;
        console.log(`[upload/submission] File received: ${req.file.originalname}, size: ${req.file.size}`);
        
        if (process.env.CLOUDINARY_URL) {
            console.log(`[upload/submission] Attempting Cloudinary upload...`);
            url = await uploadToCloudinary(req.file.buffer);
            console.log(`[upload/submission] Cloudinary upload success: ${url}`);
        } else {
            console.log(`[upload/submission] Falling back to local storage...`);
            // Fallback to local storage (Disk)
            const uploadDir = path.join(__dirname, '../../../uploads/submissions');
            if (!fs.existsSync(uploadDir)) {
                console.log(`[upload/submission] Creating directory: ${uploadDir}`);
                fs.mkdirSync(uploadDir, { recursive: true });
            }
            
            const ext = path.extname(req.file.originalname) || '.png';
            const filename = `submission_${Date.now()}_${Math.random().toString(36).slice(2,8)}${ext}`;
            const filePath = path.join(uploadDir, filename);
            
            console.log(`[upload/submission] Writing file to: ${filePath}`);
            fs.writeFileSync(filePath, req.file.buffer);

            const host = req.get('host');
            const protocol = req.protocol;
            url = `${protocol}://${host}/uploads/submissions/${filename}`;
            console.log(`[upload/submission] Local upload success: ${url}`);
        }

        res.json({ url, filename: req.file.originalname, size: req.file.size });
    } catch (error) {
        console.error("[upload/submission] Error:", {
            message: error.message,
            stack: error.stack,
            code: error.code
        });
        res.status(500).json({ 
            message: 'Lỗi upload file: ' + error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined 
        });
    }
});

module.exports = router;
