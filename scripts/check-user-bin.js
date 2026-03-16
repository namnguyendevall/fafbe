const dotenv = require('dotenv');
dotenv.config();
const pool = require('../src/config/database');

async function checkUser() {
  const email = 'binbibna@gmail.com';
  try {
    const res = await pool.query('SELECT id, email, status, email_verified FROM users WHERE email = $1', [email]);
    if (res.rows.length === 0) {
      console.log(`User ${email} NOT FOUND`);
    } else {
      console.log(`User ${email} found:`, res.rows[0]);
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkUser();
