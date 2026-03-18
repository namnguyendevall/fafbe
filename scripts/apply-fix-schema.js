require('dotenv').config();
const pool = require('../src/config/database');

async function fixSchema() {
    console.log("🛠️  Starting database schema fix...");
    try {
        await pool.query('ALTER TABLE transactions ALTER COLUMN reference_id TYPE VARCHAR(100);');
        console.log("✅ Successfully changed reference_id to VARCHAR(100)");
        
        // Verify again
        const res = await pool.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'transactions' AND column_name = 'reference_id';
        `);
        console.log("📊 Updated Schema:", res.rows[0]);
    } catch (err) {
        console.error("❌ Error fixing schema:", err);
    } finally {
        pool.end();
    }
}

fixSchema();
