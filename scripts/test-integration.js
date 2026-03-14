const { Pool } = require('pg');
const http = require('http');
const bcrypt = require('bcrypt');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const runRequest = (path, method, body, token) => {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const options = {
      hostname: '127.0.0.1',
      port: 5000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    if (token) {
        options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let responseBody = '';
      res.on('data', (d) => {
        responseBody += d;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          body: responseBody
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) req.write(data);
    req.end();
  });
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  let client;
  let adminId, clientId, workerId, cateId, skillId;
  let jobId, contractId, proposalId, checkpointId;
  let tokenAdmin, tokenClient, tokenWorker;

  try {
    console.log(`\n🚀 STARTING FULL INTEGRATION TEST...\n`);
    client = await pool.connect();
    const hash = await bcrypt.hash('TestPass123!', 10);
    const timestamp = Date.now();

    // --- SETUP ---
    console.log('--- 1. Setting up Users & Data ---');
    
    // Create Admin
    const adminEmail = `admin_${timestamp}@test.com`;
    const adminRes = await client.query(`INSERT INTO users (email, password_hash, role, status, email_verified, created_at) VALUES ($1, $2, 'ADMIN', 'ACTIVE', true, NOW()) RETURNING id`, [adminEmail, hash]);
    adminId = adminRes.rows[0].id;
    console.log(`✓ Admin created: ${adminEmail}`);

    // Create Client
    const clientEmail = `client_${timestamp}@test.com`;
    const clientRes = await client.query(`INSERT INTO users (email, password_hash, role, status, email_verified, created_at) VALUES ($1, $2, 'employer', 'ACTIVE', true, NOW()) RETURNING id`, [clientEmail, hash]);
    clientId = clientRes.rows[0].id;
    await client.query(`INSERT INTO wallets (user_id, balance_points, locked_points, updated_at) VALUES ($1, 10000, 0, NOW())`, [clientId]);
    console.log(`✓ Client created: ${clientEmail} (Balance: 10000)`);

    // Create Worker
    const workerEmail = `worker_${timestamp}@test.com`;
    const workerRes = await client.query(`INSERT INTO users (email, password_hash, role, status, email_verified, created_at) VALUES ($1, $2, 'freelancer', 'ACTIVE', true, NOW()) RETURNING id`, [workerEmail, hash]);
    workerId = workerRes.rows[0].id;
    await client.query(`INSERT INTO user_profiles (user_id, full_name, created_at) VALUES ($1, 'Test Worker', NOW())`, [workerId]);
    await client.query(`INSERT INTO wallets (user_id, balance_points, locked_points, updated_at) VALUES ($1, 0, 0, NOW())`, [workerId]);
    console.log(`✓ Worker created: ${workerEmail} (Balance: 0)`);

    // Create Category & Skill
    const cateRes = await client.query(`INSERT INTO job_categories (name, slug, is_active, created_at) VALUES ('Integration Test', 'integration-test-${timestamp}', true, NOW()) RETURNING id`);
    cateId = cateRes.rows[0].id;
    
    // Check/Create Skill
    let sRes = await client.query(`SELECT id FROM skills WHERE name = 'JavaScript'`);
    if (sRes.rows.length === 0) {
        sRes = await client.query(`INSERT INTO skills (name, slug, created_at) VALUES ('JavaScript', 'javascript', NOW()) RETURNING id`);
    }
    skillId = sRes.rows[0].id;
    await client.query(`INSERT INTO user_skills (user_id, skill_id, created_at) VALUES ($1, $2, NOW())`, [workerId, skillId]);
    console.log(`✓ Category & Skill setup complete`);

    // --- AUTH ---
    console.log('\n--- 2. Authentication ---');
    tokenAdmin = JSON.parse((await runRequest('/api/auth/login', 'POST', { email: adminEmail, password: 'TestPass123!' })).body).token;
    tokenClient = JSON.parse((await runRequest('/api/auth/login', 'POST', { email: clientEmail, password: 'TestPass123!' })).body).token;
    tokenWorker = JSON.parse((await runRequest('/api/auth/login', 'POST', { email: workerEmail, password: 'TestPass123!' })).body).token;
    console.log(`✓ All users logged in`);

    // --- JOB POSTING ---
    console.log('\n--- 3. Job Posting (Client) ---');
    const jobRes = await runRequest('/api/jobs', 'POST', {
        title: "Integration Test Job",
        description: "Testing full flow from A to Z",
        jobType: "SHORT_TERM",
        budget: 5000,
        categoryId: cateId,
        checkpoints: [{ title: "Phase 1", amount: 5000 }],
        contractContent: "Terms and conditions...",
        skills: [skillId]
    }, tokenClient);
    
    if (jobRes.statusCode !== 201) throw new Error(`Job posting failed: ${jobRes.body}`);
    const job = JSON.parse(jobRes.body).data.job;
    jobId = job.id;
    console.log(`✓ Job posted: ${jobId} (Status: ${job.status})`);
    if (job.status !== 'PENDING') throw new Error('Job status should be PENDING');

    // --- ADMIN APPROVAL ---
    console.log('\n--- 4. Job Approval (Admin) ---');
    const approveRes = await runRequest(`/api/admin/jobs/${jobId}/approve`, 'PUT', null, tokenAdmin);
    if (approveRes.statusCode !== 200) throw new Error(`Approval failed: ${approveRes.body}`);
    console.log(`✓ Job Approved (Status: OPEN)`);

    // --- JOB MATCHING ---
    console.log('\n--- 5. Job Matching (Worker) ---');
    const matchRes = await runRequest('/api/matching/jobs/recommended', 'GET', null, tokenWorker);
    const recommendedJobs = JSON.parse(matchRes.body).data;
    const foundJob = recommendedJobs.find(j => j.id === jobId);
    if (foundJob) {
        console.log(`✓ Worker found job via matching (Score: ${foundJob.match_score}%)`);
    } else {
        console.warn(`⚠ Job not found in recommendations (might be due to indexing delay or logic mismatch)`);
    }

    // --- PROPOSAL ---
    console.log('\n--- 6. Proposal Submission (Worker) ---');
    const propRes = await runRequest('/api/proposals', 'POST', {
        jobId,
        coverLetter: "I am the best fit for this job.",
        proposedPrice: 5000
    }, tokenWorker);
    
    if (propRes.statusCode !== 201) throw new Error(`Proposal failed: ${propRes.body}`);
    proposalId = JSON.parse(propRes.body).data.id;
    console.log(`✓ Proposal submitted: ${proposalId}`);

    // --- CONTRACT ---
    console.log('\n--- 7. Accept Proposal & Contract (Client) ---');
    const acceptRes = await runRequest(`/api/proposals/${proposalId}/accept`, 'PUT', null, tokenClient);
    if (acceptRes.statusCode !== 200) throw new Error(`Accept failed: ${acceptRes.body}`);
    
    const contractData = JSON.parse(acceptRes.body).data.contract;
    contractId = contractData.id;
    console.log(`✓ Proposal Accepted -> Contract Created: ${contractId}`);
    
    // Validate Wallet Lock
    const walletCheck = await client.query('SELECT balance_points, locked_points FROM wallets WHERE user_id = $1', [clientId]);
    console.log(`   Client Wallet: Balance=${walletCheck.rows[0].balance_points}, Locked=${walletCheck.rows[0].locked_points}`);
    if (walletCheck.rows[0].locked_points != 5000) throw new Error('Funds not locked correctly');

    // Get Checkpoints
    const cpRes = await client.query('SELECT id FROM checkpoints WHERE contract_id = $1', [contractId]);
    checkpointId = cpRes.rows[0].id;
    console.log(`   Checkpoint ID: ${checkpointId}`);

    // --- SIGN CONTRACT ---
    console.log('\n--- 7a. Sign Contract (Worker) ---');
    const signWorkerRes = await runRequest(`/api/contracts/${contractId}/sign`, 'POST', { otp: '123456' }, tokenWorker);
    if (signWorkerRes.statusCode !== 200) throw new Error(`Worker sign failed: ${signWorkerRes.body}`);
    console.log(`✓ Worker signed`);

    console.log('\n--- 7b. Sign Contract (Client) ---');
    const signClientRes = await runRequest(`/api/contracts/${contractId}/sign`, 'POST', { otp: '123456' }, tokenClient);
    if (signClientRes.statusCode !== 200) throw new Error(`Client sign failed: ${signClientRes.body}`);
    console.log(`✓ Client signed (Status: ACTIVE)`);

    // --- WORK SUBMISSION ---
    console.log('\n--- 8. Work Submission (Worker) ---');
    const submitRes = await runRequest(`/api/checkpoints/${checkpointId}/submit`, 'POST', {
        submission_url: "http://finished-work.com",
        submission_notes: "Here is the finished work."
    }, tokenWorker);
    if (submitRes.statusCode !== 200) throw new Error(`Submission failed: ${submitRes.body}`);
    console.log(`✓ Work submitted`);

    // --- PAYMENT RELEASE ---
    console.log('\n--- 9. Approve Work & Release Payment (Client) ---');
    const approveWorkRes = await runRequest(`/api/checkpoints/${checkpointId}/approve`, 'PUT', null, tokenClient);
    if (approveWorkRes.statusCode !== 200) throw new Error(`Work approval failed: ${approveWorkRes.body}`);
    console.log(`✓ Work Approved -> Payment Released`);

    // Validate Payment
    const workerWallet = await client.query('SELECT balance_points FROM wallets WHERE user_id = $1', [workerId]);
    console.log(`   Worker Balance: ${workerWallet.rows[0].balance_points} (Expected: 4750)`);
    if (workerWallet.rows[0].balance_points != 4750) throw new Error('Payment not received (expected 4750 after 5% fee)');

    // Complete Contract
    await client.query("UPDATE contracts SET status = 'COMPLETED' WHERE id = $1", [contractId]);
    console.log(`✓ Contract marked COMPLETED`);

    // --- REVIEW ---
    console.log('\n--- 10. Review (Worker -> Client) ---');
    const reviewRes = await runRequest('/api/reviews', 'POST', {
        contractId,
        rating: 5,
        comment: "Great client!"
    }, tokenWorker);
    if (reviewRes.statusCode !== 201) throw new Error(`Review failed: ${reviewRes.body}`);
    console.log(`✓ Review submitted`);

    console.log(`\n🎉 INTEGRATION TEST PASSED SUCCESSFULLY!`);

    // Cleanup
    console.log('\n--- Cleanup ---');
    if (client) {
         await client.query('DELETE FROM reviews WHERE contract_id = $1', [contractId]);
         await client.query('DELETE FROM checkpoints WHERE contract_id = $1', [contractId]);
         await client.query('DELETE FROM contracts WHERE id = $1', [contractId]);
         await client.query('DELETE FROM proposals WHERE id = $1', [proposalId]);
         await client.query('DELETE FROM job_skills WHERE job_id = $1', [jobId]);
         await client.query('DELETE FROM jobs WHERE id = $1', [jobId]);
         await client.query('DELETE FROM job_categories WHERE id = $1', [cateId]);
         await client.query('DELETE FROM wallets WHERE user_id IN ($1, $2)', [clientId, workerId]);
         await client.query('DELETE FROM user_profiles WHERE user_id = $1', [workerId]);
         await client.query('DELETE FROM user_skills WHERE user_id = $1', [workerId]);
         await client.query('DELETE FROM users WHERE id IN ($1, $2, $3)', [adminId, clientId, workerId]);
         console.log("✓ Cleanup complete.");
    }

  } catch (err) {
    console.error('\n❌ TEST FAILED:', err);
  } finally {
      if (client) client.release();
      await pool.end();
  }
})();
