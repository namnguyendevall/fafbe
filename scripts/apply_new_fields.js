require('dotenv').config();
const pool = require('../src/config/database');

async function up() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Thêm các fields cho jobs/contracts
    console.log('Adding fields to contracts...');
    await client.query(`ALTER TABLE contracts ADD COLUMN IF NOT EXISTS job_details TEXT`);
    await client.query(`ALTER TABLE contracts ADD COLUMN IF NOT EXISTS duration_days INT`);

    // Thêm các fields cho chat, disputes
    console.log('Adding fields to chat and disputes...');
    await client.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS image_url TEXT`);
    // Note: dispute_messages might be named something else. Let's try dispute_messages first. If it fails we'll adjust or ignore.
    await client.query(`
      DO $$
      BEGIN
          IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename  = 'dispute_messages') THEN
              ALTER TABLE dispute_messages ADD COLUMN IF NOT EXISTS image_url TEXT;
          END IF;
      END$$;
    `);

    await client.query('COMMIT');
    console.log('Migration completed.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', e);
  } finally {
    client.release();
  }
}

up().then(() => process.exit(0));
