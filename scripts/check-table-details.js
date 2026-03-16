const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const pool = require('../src/config/database');

async function check() {
  try {
    const res = await pool.query(
      "SELECT column_name, ordinal_position, column_default, is_nullable, data_type, is_identity FROM information_schema.columns WHERE table_name = 'dispute_messages' ORDER BY ordinal_position"
    );
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

check();
