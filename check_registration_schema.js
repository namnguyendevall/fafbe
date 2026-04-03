const { Pool } = require('pg');
const pool = new Pool({
  connectionString: "postgresql://postgres:s2%25Z8p3Lvw.Q,_z@db.gmgijmmojpyvxlfhelnj.supabase.co:5432/postgres",
  ssl: { rejectUnauthorized: false }
});

async function checkSchema() {
  const client = await pool.connect();
  try {
    console.log('--- USERS SCHEMA ---');
    const userCols = await client.query("SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'users'");
    console.table(userCols.rows);

    console.log('\n--- WALLETS SCHEMA ---');
    const walletCols = await client.query("SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'wallets'");
    console.table(walletCols.rows);

    console.log('\n--- TRIGGERS ---');
    const triggers = await client.query("SELECT trigger_name, event_manipulation, event_object_table, action_statement FROM information_schema.triggers");
    console.table(triggers.rows.filter(t => t.event_object_table === 'users'));
  } catch (err) {
    console.error('Error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

checkSchema();
