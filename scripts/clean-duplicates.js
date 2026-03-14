require('dotenv').config();
const pool = require("../src/config/database");

async function cleanDuplicates() {
    console.log("--- FAF Database Duplicate Cleanup ---");
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        console.log("Cleaning duplicates in user_profiles...");
        await client.query(`
            DELETE FROM user_profiles a USING (
                SELECT MIN(ctid) as keep_ctid, user_id
                FROM user_profiles
                GROUP BY user_id HAVING COUNT(*) > 1
            ) b
            WHERE a.user_id = b.user_id AND a.ctid > b.keep_ctid
        `);

        console.log("Cleaning duplicates in wallets...");
        await client.query(`
            DELETE FROM wallets a USING (
                SELECT MIN(ctid) as keep_ctid, user_id
                FROM wallets
                GROUP BY user_id HAVING COUNT(*) > 1
            ) b
            WHERE a.user_id = b.user_id AND a.ctid > b.keep_ctid
        `);

        console.log("Cleaning duplicates in user_skills...");
        await client.query(`
            DELETE FROM user_skills a USING (
                SELECT MIN(ctid) as keep_ctid, user_id, skill_id
                FROM user_skills
                GROUP BY user_id, skill_id HAVING COUNT(*) > 1
            ) b
            WHERE a.user_id = b.user_id AND a.skill_id = b.skill_id AND a.ctid > b.keep_ctid
        `);

        await client.query('COMMIT');
        console.log("✅ Cleanup complete.");
    } catch (e) {
        await client.query('ROLLBACK');
        console.error("❌ Cleanup failed:", e.message);
    } finally {
        client.release();
        pool.end();
    }
}

cleanDuplicates();
