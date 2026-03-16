const dotenv = require('dotenv');
dotenv.config();
const pool = require('../src/config/database');

async function fixSchema() {
  try {
    console.log('--- Repairing otps table schema ---');
    
    // 1. Add default to created_at if it exists, or add the column
    await pool.query(`
      ALTER TABLE otps 
      ALTER COLUMN created_at SET DEFAULT NOW();
    `);
    console.log('1. Set DEFAULT NOW() for created_at');

    // 2. Update existing nulls
    await pool.query(`
      UPDATE otps SET created_at = NOW() WHERE created_at IS NULL;
    `);
    console.log('2. Updated existing NULL created_at values to NOW()');

    // 3. Ensure is_used has a default
    await pool.query(`
      ALTER TABLE otps 
      ALTER COLUMN is_used SET DEFAULT false;
    `);
    console.log('3. Set DEFAULT false for is_used');

    // 4. Update existing null is_used
    await pool.query(`
      UPDATE otps SET is_used = false WHERE is_used IS NULL;
    `);
    console.log('4. Updated existing NULL is_used values to false');

    console.log('✅ Schema repair SUCCESS!');
    process.exit(0);
  } catch (err) {
    console.error('ERROR during repair:', err.message);
    process.exit(1);
  }
}

fixSchema();
