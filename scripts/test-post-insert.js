const dotenv = require('dotenv');
dotenv.config();
const pool = require('../src/config/database');

async function testInsert() {
  try {
    console.log('--- Testing Post Insert ---');
    // Get a valid user_id first
    const userRes = await pool.query('SELECT id FROM users LIMIT 1');
    if (userRes.rows.length === 0) {
      console.log('No users found to test with.');
      process.exit(1);
    }
    const userId = userRes.rows[0].id;
    console.log(`Testing with userId: ${userId}`);

    const res = await pool.query(
      'INSERT INTO posts (user_id, content, image_url) VALUES ($1, $2, $3) RETURNING *',
      [userId, 'Test content from script', 'http://example.com/test.jpg']
    );
    console.log('SUCCESS: Inserted post:', res.rows[0]);
    
    // Clean up
    await pool.query('DELETE FROM posts WHERE id = $1', [res.rows[0].id]);
    console.log('Cleaned up test post.');

    process.exit(0);
  } catch (err) {
    console.error('ERROR during insert:', err.message);
    console.error('Stack:', err.stack);
    process.exit(1);
  }
}

testInsert();
