const dotenv = require('dotenv');
dotenv.config();
const pool = require('../src/config/database');

async function clearAllData() {
  try {
    console.log('--- Wiping all data from database (CASCADE) ---');
    
    // 1. Get all tables in public schema
    const tablesRes = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    `);
    
    const tables = tablesRes.rows.map(r => r.table_name);
    if (tables.length === 0) {
      console.log('No tables found.');
      process.exit(0);
    }
    
    console.log(`Found ${tables.length} tables: ${tables.join(', ')}`);

    // 2. Truncate all with cascade and restart identities
    const truncateQuery = `TRUNCATE TABLE ${tables.map(t => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE;`;
    await pool.query(truncateQuery);
    
    console.log('✅ All data cleared successfully! All IDs reset to 1.');
    process.exit(0);
  } catch (err) {
    console.error('❌ ERROR clearing data:', err.message);
    process.exit(1);
  }
}

clearAllData();
