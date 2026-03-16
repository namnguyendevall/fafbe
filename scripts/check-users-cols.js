const dotenv = require('dotenv');
dotenv.config();
const pool = require('../src/config/database');

async function checkSchema() {
  try {
    const res = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'users' AND column_name IN ('id', 'email', 'role');
    `);
    console.log('--- Users Table Columns ---');
    console.table(res.rows);
    
    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  }
}

checkSchema();
