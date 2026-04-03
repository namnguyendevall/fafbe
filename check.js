require('dotenv').config();
const pool = require('./src/config/database');

async function check() {
    const { rows } = await pool.query('SELECT id, sender_id, content, image_url FROM messages ORDER BY created_at DESC LIMIT 5');
    console.log(rows);
    process.exit(0);
}
check();
