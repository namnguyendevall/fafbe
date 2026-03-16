const dotenv = require('dotenv');
dotenv.config();
const pool = require('../src/config/database');

async function checkSchema() {
  const tables = ['proposals', 'disputes', 'checkpoints'];
  try {
    for (const table of tables) {
      const res = await pool.query(`
        SELECT column_name, data_type, column_default, is_nullable, is_identity
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position;
      `, [table]);
      console.log(`--- Table: ${table} ---`);
      res.rows.forEach(row => {
          console.log(`${row.column_name} | ${row.data_type} | ${row.column_default} | ${row.is_nullable} | Identity: ${row.is_identity}`);
      });
    }
    
    process.exit(0);
  } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  }
}

checkSchema();
