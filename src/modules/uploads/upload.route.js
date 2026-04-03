const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const axios = require('axios');

const router = express.Router();

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

// Configure Cloudinary if URL is provided in .env
if (process.env.CLOUDINARY_URL) {
    cloudinary.config(); 
}

const uploadToCloudinary = (buffer, originalName, folder = 'faf_submissions') => {
    return new Promise((resolve, reject) => {
        // Extract name without extension for public_id, or just use use_filename
        const fileNameWithoutExt = path.parse(originalName).name;
        
        const stream = cloudinary.uploader.upload_stream(
            {
                folder: folder,
                resource_type: "auto",
                use_filename: true,
                unique_filename: true,
                filename_override: originalName,
                access_mode: "public"
            },
            (error, result) => {
                if (error) return reject(error);
                resolve(result); // Return entire result (includes bytes, secure_url, etc)
            }
        );
        stream.end(buffer);
    });
};

// POST /api/uploads/submission — no auth required (open endpoint)
router.post('/submission', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ message: 'Không có file' });

    try {
        let resultUrl;
        let resultSize = req.file.size;
        let resultName = req.file.originalname;

        console.log(`[upload/submission] File received: ${req.file.originalname}, size: ${req.file.size}`);
        
        if (process.env.CLOUDINARY_URL) {
            console.log(`[upload/submission] Attempting Cloudinary upload...`);
            const cloudRes = await uploadToCloudinary(req.file.buffer, req.file.originalname);
            resultUrl = cloudRes.secure_url;
            resultSize = cloudRes.bytes || req.file.size;
            resultName = cloudRes.original_filename || req.file.originalname;
            console.log(`[upload/submission] Cloudinary upload success: ${resultUrl}`);
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
            resultUrl = `${protocol}://${host}/uploads/submissions/${filename}`;
            console.log(`[upload/submission] Local upload success: ${resultUrl}`);
        }

        res.json({ url: resultUrl, filename: resultName, size: resultSize });
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

// GET /api/uploads/download — Proxy to fetch files from Cloudinary and stream to user
router.get('/download', async (req, res) => {
    const { url, name } = req.query;
    if (!url) return res.status(400).json({ message: 'URL is required' });

    console.log(`[upload/download] Proxying: ${url}, name: ${name}`);

    try {
        let fetchUrl = url;
        
        // If it's a Cloudinary URL, generate a SIGNED version to bypass 401
        if (url.includes('cloudinary.com')) {
            try {
                // Extract public_id and version correctly
                // URL: .../upload/v1234567/path/to/file.zip
                const parts = url.split('/');
                const uploadIndex = parts.indexOf('upload');
                
                if (uploadIndex !== -1 && parts.length > uploadIndex + 2) {
                    const versionStr = parts[uploadIndex + 1]; // e.g. v1775219117
                    const version = versionStr.startsWith('v') ? versionStr.substring(1) : versionStr;
                    const publicIdWithExt = parts.slice(uploadIndex + 2).join('/');
                    
                    // Generate signed URL using SDK
                    fetchUrl = cloudinary.url(publicIdWithExt, {
                        resource_type: 'raw',
                        type: 'upload',
                        version: version,
                        sign_url: true,
                        secure: true
                    });
                    
                    console.log(`[upload/download] Sign Success. Version: ${version}, ID: ${publicIdWithExt}`);
                }
            } catch (signErr) {
                console.error("[upload/download] Signing logic error:", signErr.message);
            }
        }

        console.log(`[upload/download] Fetching final URL: ${fetchUrl}`);

        const response = await axios({
            method: 'get',
            url: fetchUrl,
            responseType: 'stream',
            timeout: 30000
        });

        console.log(`[upload/download] Connected. Status: ${response.status}`);

        // Forward content type from Cloudinary
        res.setHeader('Content-Type', response.headers['content-type'] || 'application/octet-stream');
        
        // Force download with name
        const safeName = name || url.split('/').pop() || 'download';
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeName)}"`);

        // Pipe stream
        response.data.pipe(res);
    } catch (error) {
        const status = error.response?.status;
        const msg = error.response?.data?.error?.message || error.message;
        console.error(`[upload/download] Proxy Error (${status}):`, msg);
        res.status(status || 500).json({ 
            message: `Download failed: ${msg}`,
            status: status 
        });
    }
});

module.exports = router;
