const { Pool } = require('pg');
const pool = new Pool({
  connectionString: "postgresql://postgres:s2%25Z8p3Lvw.Q,_z@db.gmgijmmojpyvxlfhelnj.supabase.co:5432/postgres",
  ssl: { rejectUnauthorized: false }
});

async function checkData() {
  const client = await pool.connect();
  try {
    const catRes = await client.query("SELECT * FROM job_categories");
    console.log('Categories count:', catRes.rowCount);
    console.log('Categories:', catRes.rows);

    const skillRes = await client.query("SELECT * FROM skills");
    console.log('Skills count:', skillRes.rowCount);
    console.log('Skills:', skillRes.rows.slice(0, 5), '...');
  } catch (err) {
    console.error('Error checking data:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

checkData();
