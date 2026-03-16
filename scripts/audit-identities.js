const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const pool = require('../src/config/database');

async function audit() {
  try {
    const res = await pool.query(`
      SELECT table_name, column_name, data_type, column_default, is_identity 
      FROM information_schema.columns 
      WHERE column_name = 'id' 
      AND table_schema = 'public'
      ORDER BY table_name
    `);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

audit();
