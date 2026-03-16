const { URL } = require('url');

const cloudinaryUrl = 'cloudinary://551113128125873:-zpixJuoCfTsaNimd2xkMEw-tnw@dvnj5hfzc';

try {
    const url = new URL(cloudinaryUrl);
    console.log('Protocol:', url.protocol);
    console.log('Hostname:', url.hostname);
    console.log('Username (API Key):', url.username);
    console.log('Password (API Secret):', url.password);
} catch (e) {
    console.error('Error parsing URL:', e.message);
}
