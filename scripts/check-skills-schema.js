const dotenv = require('dotenv');
dotenv.config();
const pool = require('../src/config/database');

async function checkSkillsSchema() {
  try {
    const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'skills'
    `);
    console.log('--- Columns in "skills" table ---');
    console.table(res.rows);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkSkillsSchema();
