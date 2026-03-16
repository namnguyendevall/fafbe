const dotenv = require('dotenv');
dotenv.config();
const cloudinary = require('cloudinary').v2;
const fs = require('fs');

// Configure Cloudinary from CLOUDINARY_URL env var
if (process.env.CLOUDINARY_URL) {
    const url = new URL(process.env.CLOUDINARY_URL);
    cloudinary.config({
        cloud_name: url.hostname,
        api_key:    url.username,
        api_secret: url.password,
    });
} else {
    console.error('CLOUDINARY_URL not found in .env');
    process.exit(1);
}

const uploadToCloudinary = (buffer, folder = 'faf/posts') => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder, resource_type: 'image' },
            (error, result) => {
                if (error) return reject(error);
                resolve(result.secure_url);
            }
        );
        stream.end(buffer);
    });
};

async function testUpload() {
  try {
    console.log('--- Testing Cloudinary Upload ---');
    // We'll use a tiny dummy buffer (1x1 transparent pixel)
    const dummyBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==', 'base64');
    
    const url = await uploadToCloudinary(dummyBuffer);
    console.log('SUCCESS: Uploaded to Cloudinary:', url);
    process.exit(0);
  } catch (err) {
    console.error('ERROR during Cloudinary upload:', err.message);
    process.exit(1);
  }
}

testUpload();
