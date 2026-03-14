require('dotenv').config();
const pool = require('../src/config/database');

async function createCacheTable() {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS ai_match_cache (
                id SERIAL PRIMARY KEY,
                worker_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                job_id INTEGER REFERENCES jobs(id) ON DELETE CASCADE,
                match_score INTEGER NOT NULL,
                reason TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(worker_id, job_id)
            );
        `);
        console.log('✅ ai_match_cache table created or already exists');
    } catch (e) {
        console.error('❌ Failed to create ai_match_cache table', e);
    } finally {
        client.release();
        process.exit(0);
    }
}
createCacheTable();
