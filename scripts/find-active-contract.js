const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

(async () => {
  try {
    const { rows } = await pool.query(`
      SELECT c.id as contract_id, cp.id as checkpoint_id 
      FROM contracts c 
      JOIN checkpoints cp ON c.id = cp.contract_id 
      JOIN users u ON c.worker_id = u.id 
      WHERE u.email = 'ergfe3@yopmail.com' 
      AND c.status = 'ACTIVE' 
      LIMIT 1
    `);
    if (rows.length > 0) {
      console.log(JSON.stringify(rows[0]));
    } else {
      console.log(JSON.stringify({ error: 'No active contract found' }));
    }
  } catch (e) {
    console.error(JSON.stringify({ error: e.message }));
  } finally {
    await pool.end();
  }
})();
