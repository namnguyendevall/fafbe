require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require("../src/config/database");

async function fixConstraints() {
    console.log("--- FAF Database Constraint Fix ---");
    const sqlPath = path.join(__dirname, '../migrations/fix_constraints.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    const client = await pool.connect();
    try {
        console.log("Applying missing constraints...");
        await client.query(sql);
        console.log("✅ Constraints fixed successfully.");
    } catch (e) {
        console.error("❌ Failed to fix constraints:", e.message);
    } finally {
        client.release();
        pool.end();
    }
}

fixConstraints();
