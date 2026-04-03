const pool = require("../../config/database");
const sql = require("./proposal.sql");
const { getJobById } = require("../jobs/job.service");

exports.createProposal = async ({ jobId, workerId, coverLetter, proposedPrice }) => {
  const client = await pool.connect();
  try {
    // 1. Check Job
    const job = await getJobById(jobId);
    if (!job) throw new Error("JOB_NOT_FOUND");
    if (job.status !== 'OPEN') throw new Error("JOB_NOT_OPEN");

    // 2. Check Existing Proposal
    const existingRes = await client.query(sql.checkExisting, [jobId, workerId]);
    if (existingRes.rows.length > 0) throw new Error("ALREADY_APPLIED");

    // 2.1 Check Active or Pending Contract (Exclusive Work Policy)
    const activeContractRes = await client.query(`SELECT id FROM contracts WHERE worker_id = $1 AND status IN ('PENDING', 'ACTIVE')`, [workerId]);
    if (activeContractRes.rows.length > 0) throw new Error("WORKER_BUSY_CANNOT_APPLY");

    // 2.5 Moderate cover letter
    const moderationService = require('../../services/moderation.service');
    const moderationResult = await moderationService.moderateContent(coverLetter || '');
    const moderationStatus = moderationService.getModerationStatus(moderationResult.approved);

    // 3. Create with moderation
    const { rows } = await client.query(sql.create, [
      jobId, 
      workerId, 
      coverLetter, 
      proposedPrice, 
      moderationStatus, 
      JSON.stringify(moderationResult)
    ]);
    
    return rows[0];

  } finally {
    client.release();
  }
};

exports.getProposalsByJob = async (jobId) => {
  const { rows } = await pool.query(sql.listByJob, [jobId]);
  return rows;
};

exports.getMyProposals = async (workerId) => {
  const { rows } = await pool.query(sql.listByWorker, [workerId]);
  return rows;
};

exports.acceptProposal = async (proposalId, clientId) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Get Proposal
    const { rows: pRows } = await client.query(sql.getById, [proposalId]);
    const proposal = pRows[0];
    if (!proposal) throw new Error("PROPOSAL_NOT_FOUND");

    // Guard: Only PENDING proposals can be accepted
    if (proposal.status !== 'PENDING') {
        throw new Error("Chỉ có thể chấp nhận các đề xuất đang ở trạng thái chờ (PENDING).");
    }

    // 2. Validate Job Ownership
    const jobRes = await client.query('SELECT * FROM jobs WHERE id = $1', [proposal.job_id]);
    const job = jobRes.rows[0];
    if (!job) throw new Error("JOB_NOT_FOUND");
    if (job.client_id !== clientId) throw new Error("UNAUTHORIZED");

    // Guard: Job must be OPEN to accept a new proposal
    if (job.status !== 'OPEN') {
        throw new Error("Công việc hiện không ở trạng thái mở để chấp nhận đề xuất mới.");
    }

    // 2.1 CHECK WORKER BUSY STATUS (Restriction: 1 Active/Pending Job)
    const activeContractRes = await client.query(`
        SELECT id FROM contracts 
        WHERE worker_id = $1 AND status IN ('PENDING', 'ACTIVE')
    `, [proposal.worker_id]);
    
    if (activeContractRes.rows.length > 0) {
        throw new Error("WORKER_HAS_ACTIVE_OR_PENDING_JOB");
    }

    // 2.2 ENSURE WORKER PROFILE EXISTS (to prevent JOIN errors later)
    const workerProfileRes = await client.query('SELECT user_id FROM user_profiles WHERE user_id = $1', [proposal.worker_id]);
    if (workerProfileRes.rows.length === 0) {
        // Get email/name from users table to use as initial full_name
        const userRes = await client.query('SELECT email FROM users WHERE id = $1', [proposal.worker_id]);
        const userName = userRes.rows[0]?.email?.split('@')[0] || 'Worker';
        await client.query('INSERT INTO user_profiles (user_id, full_name, created_at) VALUES ($1, $2, NOW())', [proposal.worker_id, userName]);
        console.log(`[ProposalService] Created default profile for worker ${proposal.worker_id} (${userName})`);
    }

    // 3. Update Proposal Status
    const updateRes = await client.query(sql.updateStatus, [proposalId, 'ACCEPTED']);
    const updatedProposal = updateRes.rows[0];

    // 4. Update Contract (Assign Worker & PENDING)
    // Find the DRAFT contract for this job and assign worker
    const contractRes = await client.query(`
        UPDATE contracts 
        SET worker_id = $1, status = 'PENDING',
            signature_worker = NULL, signature_client = NULL, signed_at = NULL,
            updated_at = NOW()
        WHERE job_id = $2 AND status = 'DRAFT'
        RETURNING *
    `, [proposal.worker_id, proposal.job_id]);
    
    const contract = contractRes.rows[0];
    if (!contract) throw new Error("CONTRACT_NOT_FOUND");
    
    // 4.1 Inject Worker Info into the Contract Content HTML
    const workerRes = await client.query('SELECT u.email, u.id, p.full_name FROM users u LEFT JOIN user_profiles p ON u.id = p.user_id WHERE u.id = $1', [proposal.worker_id]);
    const workerInfo = workerRes.rows[0];
    
    if (workerInfo && contract.contract_content) {
        const parts = contract.contract_content.split('Bên B - Người nhận việc');
        if (parts.length > 1) {
            let workerPart = parts[1]
                .replace(/(Họ và tên:(?:<\/?[^>]+>|\s)*)\.{5,}/, `$1${workerInfo.full_name || 'N/A'}`)
                .replace(/(Email đăng ký trên hệ thống FAF:(?:<\/?[^>]+>|\s)*)\.{5,}/, `$1${workerInfo.email || 'N/A'}`)
                .replace(/(ID người dùng FAF:(?:<\/?[^>]+>|\s)*)\.{5,}/, `$1${workerInfo.id || 'N/A'}`);
            
            const newContent = parts[0] + 'Bên B - Người nhận việc' + workerPart;
            await client.query('UPDATE contracts SET contract_content = $1 WHERE id = $2', [newContent, contract.id]);
            contract.contract_content = newContent;
        }
    }
    
    // 5. FUNDS HANDLING: Funds are already locked in wallets.locked_points 
    // when the job was created in job.service.js. 
    // No further lock/deduction needed here.


    // 6. Auto-Cleanup: Delete other pending proposals by THIS worker (Exclusive Work Policy)
    await client.query(`
        DELETE FROM proposals 
        WHERE worker_id = $1 AND status = 'PENDING' AND id != $2
    `, [proposal.worker_id, proposal.id]);

    // 6.1 Auto-Reject ALL other workers for THIS job
    await client.query(`
        UPDATE proposals 
        SET status = 'REJECTED', updated_at = NOW()
        WHERE job_id = $1 AND id != $2 AND status = 'PENDING'
    `, [proposal.job_id, proposal.id]);

    // 7. Update Job Status to PENDING_SIGNATURE
    await client.query("UPDATE jobs SET status = 'PENDING_SIGNATURE', updated_at = NOW() WHERE id = $1", [proposal.job_id]);
    
    await client.query("COMMIT");
    return { proposal: updatedProposal, contract, job };


  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
};

exports.rejectProposal = async (proposalId, clientId) => {
    // Similar to accept but just update status
    const client = await pool.connect();
    try {
        const { rows: pRows } = await client.query(sql.getById, [proposalId]);
        const proposal = pRows[0];
        if (!proposal) throw new Error("PROPOSAL_NOT_FOUND");
        
        const jobRes = await client.query('SELECT * FROM jobs WHERE id = $1', [proposal.job_id]);
        const job = jobRes.rows[0];
        if (job.client_id !== clientId) throw new Error("UNAUTHORIZED");

        const updateRes = await client.query(sql.updateStatus, [proposalId, 'REJECTED']);
        return updateRes.rows[0];
    } finally {
        client.release();
    }
};
