const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres:s2%25Z8p3Lvw.Q,_z@db.gmgijmmojpyvxlfhelnj.supabase.co:5432/postgres';

async function checkDb() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    const jobsResult = await client.query('SELECT id, title, status, job_type FROM jobs');
    console.log('Current jobs in DB:');
    console.table(jobsResult.rows);
  } catch (err) {
    console.error('DB Error:', err.message);
  } finally {
    await client.end();
  }
}

checkDb();
