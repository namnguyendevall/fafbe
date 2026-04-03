const { Pool } = require('pg');
const pool = new Pool({
  connectionString: "postgresql://postgres:s2%25Z8p3Lvw.Q,_z@db.gmgijmmojpyvxlfhelnj.supabase.co:5432/postgres",
  ssl: { rejectUnauthorized: false }
});

async function checkOtps() {
  const client = await pool.connect();
  try {
    console.log('--- OTPS SCHEMA ---');
    const otpCols = await client.query("SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'otps'");
    console.table(otpCols.rows);

    const otpData = await client.query("SELECT * FROM otps");
    console.log('OTPs count:', otpData.rowCount);
    console.log('OTPs:', otpData.rows);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

checkOtps();
