require('dotenv').config();
const pool = require('./src/config/database');
async function run() {
    try {
        await pool.query('ALTER TABLE checkpoints ADD COLUMN resource_urls JSONB DEFAULT \'[]\'::jsonb');
        console.log('Success altering checkpoints table');
    } catch (e) {
        console.error(e);
    }
    process.exit(0);
}
run();
