require('dotenv').config();
const pool = require('../src/config/database');

async function check() {
  const tables = ['proposals', 'disputes', 'dispute_messages'];
  try {
    for (const table of tables) {
      const res = await pool.query(
        "SELECT column_name, is_identity FROM information_schema.columns WHERE table_name = $1 AND column_name = 'id'",
        [table]
      );
      console.log(`${table}:`, res.rows[0] || 'NOT FOUND');
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

check();
