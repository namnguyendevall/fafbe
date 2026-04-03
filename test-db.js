require('dotenv').config();
const pool = require('./src/config/database');
pool.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'jobs'").then(res => {
    console.log(res.rows.map(r => r.column_name));
    process.exit(0);
});
