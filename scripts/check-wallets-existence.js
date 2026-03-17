require('dotenv').config();
const pool = require('../src/config/database');

async function checkWallets() {
    try {
        const res = await pool.query(`
            SELECT w.*, u.id as user_id_check 
            FROM wallets w 
            RIGHT JOIN users u ON w.user_id = u.id 
            LIMIT 10;
        `);
        console.table(res.rows);
    } catch (err) {
        console.error(err);
    } finally {
        pool.end();
    }
}

checkWallets();
