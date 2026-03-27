const { Pool } = require('pg'); 
require('dotenv').config(); 
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } }); 
async function check() { 
    const sql = `
        SELECT p.*, j.title as job_title, j.budget as job_budget, c.name as category_name 
        FROM proposals p 
        JOIN jobs j ON j.id = p.job_id 
        JOIN job_categories c ON c.id = j.category_id 
        WHERE p.worker_id = 311 
        ORDER BY p.created_at DESC
    `;
    const res = await pool.query(sql);
    console.log('Proposals found:', res.rows.length);
    console.log(JSON.stringify(res.rows, null, 2));
    process.exit(); 
} 
check();
