const { Pool } = require('pg');
const pool = new Pool({
  connectionString: "postgresql://postgres:s2%25Z8p3Lvw.Q,_z@db.gmgijmmojpyvxlfhelnj.supabase.co:5432/postgres",
  ssl: { rejectUnauthorized: false }
});

async function activateData() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    console.log('Activating categories...');
    await client.query("UPDATE job_categories SET is_active = true, created_at = NOW()");
    
    console.log('Activating skills...');
    await client.query("UPDATE skills SET is_active = true, created_at = NOW()");
    
    await client.query('COMMIT');
    console.log('DATA ACTIVATED SUCCESSFULLY!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error activating data:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

activateData();
