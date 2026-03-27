const { Pool } = require('pg');
const pool = new Pool({
  connectionString: "postgresql://postgres:s2%25Z8p3Lvw.Q,_z@db.gmgijmmojpyvxlfhelnj.supabase.co:5432/postgres",
  ssl: { rejectUnauthorized: false }
});

async function checkWallets() {
  const client = await pool.connect();
  try {
    const res = await client.query("SELECT u.id, u.email, w.balance_points FROM users u JOIN wallets w ON u.id = w.user_id");
    console.log('User Wallets:', res.rows);
  } catch (err) {
    console.error('Error checking wallets:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

checkWallets();
