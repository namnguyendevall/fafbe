const { Pool } = require('pg');
const pool = new Pool({
  connectionString: "postgresql://postgres:s2%25Z8p3Lvw.Q,_z@db.gmgijmmojpyvxlfhelnj.supabase.co:5432/postgres",
  ssl: { rejectUnauthorized: false }
});

async function resetSequence() {
  console.log('Connecting to database...');
  const client = await pool.connect();
  try {
    console.log('Fetching max ID from review_skill_ratings...');
    const res = await client.query("SELECT MAX(id) FROM review_skill_ratings");
    const maxId = res.rows[0].max || 0;
    const nextId = maxId + 1;
    console.log(`Setting sequence to ${nextId}...`);
    await client.query(`ALTER SEQUENCE review_skill_ratings_id_seq RESTART WITH ${nextId}`);
    console.log(`Successfully reset review_skill_ratings_id_seq to ${nextId}`);
  } catch (err) {
    console.error('Error resetting sequence:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

resetSequence();
