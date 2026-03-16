const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const pool = require('../src/config/database');

async function test() {
  try {
    console.log("Testing manual insert into dispute_messages...");
    // We try to insert WITHOUT the id column
    const res = await pool.query(
      "INSERT INTO dispute_messages (dispute_id, sender_id, message, attachments, created_at) VALUES ($1, $2, $3, $4, NOW()) RETURNING *",
      [1, 1, 'test message from script', []]
    );
    console.log("Insert Success:", res.rows[0]);
  } catch (err) {
    console.error("Insert Failed:");
    console.error(err);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

test();
