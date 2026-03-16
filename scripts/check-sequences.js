const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const pool = require('../src/config/database');

async function check() {
  try {
    const res = await pool.query(
      "SELECT pg_get_serial_sequence('dispute_messages', 'id') as seq_name"
    );
    console.log("Sequence name:", res.rows[0].seq_name);
    
    if (res.rows[0].seq_name) {
      const seqRes = await pool.query(`SELECT last_value, is_called FROM ${res.rows[0].seq_name}`);
      console.log("Sequence status:", seqRes.rows[0]);
    }

    const identityRes = await pool.query(
      "SELECT is_identity, identity_generation, identity_start, identity_increment FROM information_schema.columns WHERE table_name = 'dispute_messages' AND column_name = 'id'"
    );
    console.log("Identity details:", identityRes.rows[0]);

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

check();
