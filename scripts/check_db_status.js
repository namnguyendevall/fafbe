const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres:s2%25Z8p3Lvw.Q,_z@db.gmgijmmojpyvxlfhelnj.supabase.co:5432/postgres';

async function checkDb() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to DB successfully');

    const usersResult = await client.query('SELECT COUNT(*) FROM users');
    console.log(`Users count: ${usersResult.rows[0].count}`);

    const jobsResult = await client.query('SELECT COUNT(*) FROM jobs');
    console.log(`Jobs count: ${jobsResult.rows[0].count}`);

    if (jobsResult.rows[0].count > 0) {
      const jobs = await client.query('SELECT id, title, job_type FROM jobs LIMIT 5');
      console.log('Sample jobs:', JSON.stringify(jobs.rows, null, 2));
    }
  } catch (err) {
    console.error('DB Error:', err.message);
  } finally {
    await client.end();
  }
}

checkDb();
