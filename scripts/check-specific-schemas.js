const dotenv = require('dotenv');
dotenv.config();
const pool = require('../src/config/database');

async function checkSchema() {
  const tables = ['proposals', 'disputes', 'checkpoints'];
  try {
    const results = {};
    for (const table of tables) {
      const res = await pool.query(`
        SELECT column_name, data_type, is_identity, column_default, is_nullable
        FROM information_schema.columns 
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [table]);
      results[table] = res.rows;
    }
    console.log(JSON.stringify(results, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkSchema();
