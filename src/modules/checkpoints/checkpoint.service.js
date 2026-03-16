const pool = require("../../config/database");
const sql = require("./checkpoint.sql");

// Helper to get Wallet
const getWallet = async (client, userId) => {
    const { rows } = await client.query('SELECT * FROM wallets WHERE user_id = $1', [userId]);
    return rows[0];
};

exports.submitWork = async ({ checkpointId, workerId, submissionData }) => {
    const client = await pool.connect();
    try {
        // 1. Verify Checkpoint & Contract
        const cpRes = await client.query(sql.getById, [checkpointId]);
        const cp = cpRes.rows[0];
        if (!cp) throw new Error("CHECKPOINT_NOT_FOUND");
        
        // 1.1 Check Rework Limit
        if (cp.rework_count >= cp.rework_limit) {
            throw new Error("REWORK_LIMIT_REACHED");
        }

        // Check Contract
        const contractRes = await client.query('SELECT * FROM contracts WHERE id = $1', [cp.contract_id]);
        const contract = contractRes.rows[0];
        if (!contract) throw new Error("CONTRACT_NOT_FOUND");
        if (contract.worker_id !== workerId) throw new Error("UNAUTHORIZED");
        if (contract.status !== 'ACTIVE') throw new Error("CONTRACT_NOT_ACTIVE");

        // 2. Update Checkpoint with Submission
        const { rows } = await client.query(sql.submit, [checkpointId, submissionData.submission_url, submissionData.submission_notes || '']);
        
        return rows[0];
    } finally {

        client.release();
    }
};

exports.approveWork = async (checkpointId, clientId) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // 1. Verify Checkpoint
        const cpRes = await client.query(sql.getById, [checkpointId]);
        const cp = cpRes.rows[0];
        if (!cp) throw new Error("CHECKPOINT_NOT_FOUND");
        if (cp.status === 'APPROVED') throw new Error("ALREADY_APPROVED");

        // 2. Verify Client ownership
        const contractRes = await client.query('SELECT * FROM contracts WHERE id = $1', [cp.contract_id]);
        const contract = contractRes.rows[0];
        const jobRes = await client.query('SELECT * FROM jobs WHERE id = $1', [contract.job_id]);
        const job = jobRes.rows[0];

        if (job.client_id !== clientId) throw new Error("UNAUTHORIZED");

        // 3. RELEASE FUND LOGIC with 5% System Fee
        const walletService = require("../wallets/wallet.service");
        await walletService.releaseCheckpointFunds(client, {
            clientId,
            workerId: contract.worker_id,
            amount: Number(cp.amount),
            referenceId: checkpointId,
            referenceType: 'CHECKPOINT'
        });





        // 4. Update Checkpoint Status
        await client.query(sql.updateStatus, [checkpointId, 'APPROVED']);
        
        // 5. Check if all checkpoints in this contract are now APPROVED
        const allCpsRes = await client.query('SELECT status FROM checkpoints WHERE contract_id = $1', [contract.id]);
        const allApproved = allCpsRes.rows.every(r => r.status === 'APPROVED');

        if (allApproved) {
            await client.query(`UPDATE contracts SET status = 'COMPLETED', updated_at = NOW() WHERE id = $1`, [contract.id]);
            await client.query(`UPDATE jobs SET status = 'COMPLETED', updated_at = NOW() WHERE id = $1`, [contract.job_id]);
        }

        await client.query("COMMIT");
        return { 
            message: "Work approved and funds released",
            contractCompleted: allApproved,
            contractId: contract.id,
            clientId: contract.client_id,
            workerId: contract.worker_id,
            jobTitle: job.title
        };


    } catch (e) {
        await client.query("ROLLBACK");
        throw e;
    } finally {
        client.release();
    }
};

exports.rejectWork = async (checkpointId, clientId) => {
    const client = await pool.connect();
    try {
        const cpRes = await client.query(sql.getById, [checkpointId]);
        const cp = cpRes.rows[0];
        
        // Validate Ownership (same as approve)
         const contractRes = await client.query('SELECT * FROM contracts WHERE id = $1', [cp.contract_id]);
        const contract = contractRes.rows[0];
        const jobRes = await client.query('SELECT * FROM jobs WHERE id = $1', [contract.job_id]);
        const job = jobRes.rows[0];

        if (job.client_id !== clientId) throw new Error("UNAUTHORIZED");

        // Update status back to REJECTED and increment rework_count
        const { rows } = await client.query(`
            UPDATE checkpoints 
            SET status = 'REJECTED', 
                rework_count = rework_count + 1,
                updated_at = NOW() 
            WHERE id = $1 
            RETURNING *
        `, [checkpointId]);
        return rows[0];

    } finally {
        client.release();
    }
};
