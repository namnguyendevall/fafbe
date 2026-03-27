const { Pool } = require('pg');
const pool = new Pool({
  connectionString: "postgresql://postgres:s2%25Z8p3Lvw.Q,_z@db.gmgijmmojpyvxlfhelnj.supabase.co:5432/postgres",
  ssl: { rejectUnauthorized: false }
});

async function addCredits() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('Adding 1,000,000 credits to all users...');
    await client.query("UPDATE wallets SET balance_points = balance_points + 1000000");
    await client.query('COMMIT');
    console.log('CREDITS ADDED SUCCESSFULLY!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error adding credits:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

addCredits();
