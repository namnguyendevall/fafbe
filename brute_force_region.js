const { Pool } = require('pg');

const projectRef = 'gmgijmmojpyvxlfhelnj';
const password = 's2%Z8p3Lvw.Q,_z';
const dbName = 'postgres';

const regions = [
  'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1', 'ap-northeast-2',
  'ap-northeast-3', 'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'eu-central-1', 'eu-west-1', 'eu-west-2', 'eu-west-3', 'ca-central-1',
  'sa-east-1', 'ap-south-1', 'me-central-1', 'af-south-1'
];

async function testRegion(region) {
  const host = `aws-0-${region}.pooler.supabase.com`;
  const connectionString = `postgresql://postgres.${projectRef}:${password}@${host}:6543/${dbName}?pgbouncer=true`;
  
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000
  });

  try {
    const res = await pool.query('SELECT NOW()');
    console.log(`[SUCCESS] Region found: ${region}`);
    return true;
  } catch (err) {
    if (err.message.includes('Tenant or user not found')) {
        // Expected if wrong region
    } else {
        console.log(`[ERROR] Region ${region} failed with: ${err.message}`);
    }
    return false;
  } finally {
    await pool.end();
  }
}

async function start() {
    console.log('Starting regional brute-force for Supabase pooler...');
    for (const region of regions) {
        process.stdout.write(`Testing ${region}... `);
        const ok = await testRegion(region);
        if (ok) {
            console.log('\n\nFOUND IT!');
            process.exit(0);
        }
        process.stdout.write('FAILED\n');
    }
    console.log('\nFinished. No region worked.');
}

start();
