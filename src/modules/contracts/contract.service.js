const pool = require("../../config/database");
const sql = require("./contract.sql");
const crypto = require('crypto');
const postService = require("../posts/post.service");

exports.updateContent = async ({ contractId, userId, content }) => {
    const client = await pool.connect();
    try {
        const res = await client.query('SELECT * FROM contracts WHERE id = $1', [contractId]);
        const contract = res.rows[0];
        if (!contract) throw new Error("CONTRACT_NOT_FOUND");
        
        // Only Client can update content? Or both? Usually Client proposes.
        if (contract.client_id != userId) throw new Error("UNAUTHORIZED");
        
        // Cannot update if already signed by anyone?
        if (contract.signature_client || contract.signature_worker) throw new Error("CANNOT_UPDATE_SIGNED_CONTRACT");

        const updateRes = await client.query(sql.updateContent, [contractId, content]);
        return updateRes.rows[0];
    } finally {
        client.release();
    }
};

exports.signContract = async ({ contractId, userId }) => {
    const client = await pool.connect();
    try {
        const res = await client.query('SELECT * FROM contracts WHERE id = $1', [contractId]);
        const contract = res.rows[0];
        if (!contract) throw new Error("CONTRACT_NOT_FOUND");

        // Verify Participant
        let role = '';
        if (contract.client_id == userId) role = 'client';
        else if (contract.worker_id == userId) role = 'worker';
        else throw new Error("UNAUTHORIZED");

        // Generate Digital Signature
        // Naming-as-signature: Use full_name if available, otherwise email prefix
        const userRes = await client.query('SELECT full_name, email FROM user_profiles p JOIN users u ON p.user_id = u.id WHERE u.id = $1', [userId]);
        const profile = userRes.rows[0];
        const signature = profile?.full_name || profile?.email?.split('@')[0] || `USER_${userId}`;

        let updateRes;
        if (role === 'client') {
            updateRes = await client.query(sql.signContractClient, [contractId, signature]);
        } else {
            updateRes = await client.query(sql.signContractWorker, [contractId, signature]);
        }

        let updatedContract = updateRes.rows[0];

        // If both parties have signed, activate and finalize content
        if (updatedContract.signature_worker && updatedContract.signature_client) {
            // Get both names and profile info
            const participantsRes = await client.query(`
                SELECT u.id, u.email, u.role, p.full_name 
                FROM users u 
                LEFT JOIN user_profiles p ON u.id = p.user_id 
                WHERE u.id IN ($1, $2)
            `, [updatedContract.client_id, updatedContract.worker_id]);
            
            const clientInfo = participantsRes.rows.find(r => r.id == updatedContract.client_id);
            const workerInfo = participantsRes.rows.find(r => r.id == updatedContract.worker_id);

            const finalizedDate = new Date();
            const dateStr = finalizedDate.toLocaleDateString('vi-VN');
            const [day, month, year] = dateStr.split('/');

            // Finalize Contract Content by replacing placeholders
            let finalizedContent = updatedContract.contract_content || '';
            
            // Fill Worker Info securely (fallback if missing)
            const parts = finalizedContent.split('Bên B - Người nhận việc');
            if (parts.length > 1) {
                let workerPart = parts[1]
                    .replace(/(Họ và tên:(?:<\/?[^>]+>|\s)*)\.{5,}/, `$1${workerInfo?.full_name || 'N/A'}`)
                    .replace(/(Email đăng ký trên hệ thống FAF:(?:<\/?[^>]+>|\s)*)\.{5,}/, `$1${workerInfo?.email || 'N/A'}`)
                    .replace(/(ID người dùng FAF:(?:<\/?[^>]+>|\s)*)\.{5,}/, `$1${workerInfo?.id || 'N/A'}`);
                finalizedContent = parts[0] + 'Bên B - Người nhận việc' + workerPart;
            }

            // Fill Signatures securely
            const partsA = finalizedContent.split('Bên A - Người giao việc (Ký và ghi rõ họ tên)');
            if (partsA.length > 1) {
                partsA[1] = partsA[1].replace(/\.{10,}/, updatedContract.signature_client);
                finalizedContent = partsA[0] + 'Bên A - Người giao việc (Ký và ghi rõ họ tên)' + partsA[1];
            }

            const partsB = finalizedContent.split('Bên B - Người nhận việc (Ký và ghi rõ họ tên)');
            if (partsB.length > 1) {
                partsB[1] = partsB[1].replace(/\.{10,}/, updatedContract.signature_worker);
                finalizedContent = partsB[0] + 'Bên B - Người nhận việc (Ký và ghi rõ họ tên)' + partsB[1];
            }

            // Fill Dates
            finalizedContent = finalizedContent.replace(/Ngày[\s\.]*tháng[\s\.]*năm[\s\.]*/i, `Ngày ${day || '...'} tháng ${month || '...'} năm ${year || '...'}`);

            // Update DB with finalized content and status
            const finalRes = await client.query(
                `UPDATE contracts 
                 SET status = 'ACTIVE', 
                     contract_content = $2,
                     signed_at = NOW(), 
                     updated_at = NOW() 
                 WHERE id = $1 
                 RETURNING *`,
                [contractId, finalizedContent]
            );
            updatedContract = finalRes.rows[0];

            // Calculate Checkpoint due_dates dynamically based on duration_days
            const cpsRes = await client.query('SELECT id, duration_days FROM checkpoints WHERE contract_id = $1 ORDER BY id ASC', [contractId]);
            let cumulativeDays = 0;
            for (const cp of cpsRes.rows) {
                cumulativeDays += (cp.duration_days || 7);
                await client.query(
                    `UPDATE checkpoints SET due_date = NOW() + interval '${cumulativeDays} days' WHERE id = $1`,
                    [cp.id]
                );
            }

            // Notify both parties via Email (Async to avoid blocking)
            emailServiceWrapper(client, contract).catch(err => console.error("Email service error:", err));
        }

        return updatedContract;

    } finally {
        client.release();
    }
};

async function emailServiceWrapper(client, contract) {
    try {
        const emailService = require('../email/email.service');
        const usersRes = await client.query('SELECT id, email, role FROM users WHERE id IN ($1, $2)', [contract.client_id, contract.worker_id]);
        const jobRes = await client.query('SELECT title FROM jobs WHERE id = $1', [contract.job_id]);
        const jobTitle = jobRes.rows[0]?.title || 'Your Project';
        
        for (const u of usersRes.rows) {
            await emailService.sendContractSignedEmail({
                to: u.email,
                jobTitle: jobTitle,
                role: u.role,
                contractContent: contract.contract_content
            });
        }
    } catch (err) {
        console.error("Failed to send signed contract emails:", err);
    }
}


exports.getContract = async (id) => {
    const { rows } = await pool.query(sql.getById, [id]);
    const contract = rows[0];
    if (!contract) return null;
    
    // Include checkpoints
    const checkpointsRes = await pool.query(sql.getCheckpointsByContract, [contract.id]);
    contract.checkpoints = checkpointsRes.rows;
    
    return contract;
};

exports.getActiveContractByWorker = async (workerId) => {
    const { rows } = await pool.query(sql.getActiveContractByWorker, [workerId]);
    if (rows.length === 0) return null;

    const contract = rows[0];
    
    // Get checkpoints for this contract
    const checkpointsRes = await pool.query(sql.getCheckpointsByContract, [contract.id]);
    contract.checkpoints = checkpointsRes.rows;
    
    return contract;
};

exports.getContractByJobAndWorker = async (jobId, workerId) => {
    const client = await pool.connect();
    try {
        const result = await client.query(sql.getContractByJobAndWorker, [jobId, workerId]);
        if (result.rows.length === 0) return null;
        
        const contract = result.rows[0];
        const checkpoints = await client.query(sql.getCheckpointsByContract, [contract.id]);
        contract.checkpoints = checkpoints.rows;
        
        return contract;
    } catch (error) {
        throw error;
    } finally {
        client.release();
    }
};

exports.getContractsByUser = async (userId) => {
    const client = await pool.connect();
    try {
        const result = await client.query(sql.getContractsByUser, [userId]);
        return result.rows;
    } catch (error) {
        throw error;
    } finally {
        client.release();
    }
};

exports.submitCheckpoint = async ({ checkpointId, workerId, submissionUrl, submissionNotes }) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const cpRes = await client.query('SELECT * FROM checkpoints WHERE id = $1', [checkpointId]);
        const cp = cpRes.rows[0];
        if (!cp) throw new Error('CHECKPOINT_NOT_FOUND');
        if (!['PENDING', 'SUBMITTED', 'REJECTED'].includes(cp.status)) {
            throw new Error('CHECKPOINT_CANNOT_BE_SUBMITTED');
        }

        const contractRes = await client.query('SELECT * FROM contracts WHERE id = $1', [cp.contract_id]);
        const contract = contractRes.rows[0];
        if (!contract || contract.worker_id != workerId) throw new Error('UNAUTHORIZED');
        
        // Enforce dual signature requirement before allowing work submission
        if (!contract.signature_worker || !contract.signature_client) {
            throw new Error('CONTRACT_NOT_FULLY_SIGNED');
        }

        const result = await client.query(sql.submitCheckpoint, [checkpointId, submissionUrl, submissionNotes]);
        await client.query('COMMIT');
        return result.rows[0];
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

exports.approveCheckpoint = async ({ checkpointId, clientId, reviewNotes }) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const cpRes = await client.query('SELECT * FROM checkpoints WHERE id = $1', [checkpointId]);
        const cp = cpRes.rows[0];
        if (!cp) throw new Error('CHECKPOINT_NOT_FOUND');
        if (cp.status !== 'SUBMITTED') throw new Error('CHECKPOINT_NOT_SUBMITTED');

        const contractRes = await client.query('SELECT * FROM contracts WHERE id = $1', [cp.contract_id]);
        const contract = contractRes.rows[0];
        if (!contract || contract.client_id != clientId) throw new Error('UNAUTHORIZED');

        const result = await client.query(sql.approveCheckpoint, [checkpointId, reviewNotes]);
        
        // 3. RELEASE FUND LOGIC with 5% System Fee
        const walletService = require("../wallets/wallet.service");
        await walletService.releaseCheckpointFunds(client, {
            clientId,
            workerId: contract.worker_id,
            amount: Number(cp.amount),
            referenceId: checkpointId,
            referenceType: 'CHECKPOINT'
        });

        // 4. Check if all checkpoints in this contract are now APPROVED
        const allCpsRes = await client.query('SELECT status FROM checkpoints WHERE contract_id = $1', [contract.id]);
        const allApproved = allCpsRes.rows.every(r => r.status === 'APPROVED');

        if (allApproved) {
            await client.query(`UPDATE contracts SET status = 'COMPLETED', updated_at = NOW() WHERE id = $1`, [contract.id]);
            await client.query(`UPDATE jobs SET status = 'COMPLETED', updated_at = NOW() WHERE id = $1`, [contract.job_id]);

            // ✅ Update worker stats: increment total_jobs_done
            await client.query(`
                INSERT INTO user_profiles (user_id, total_jobs_done, updated_at)
                VALUES ($1, 1, NOW())
                ON CONFLICT (user_id) DO UPDATE SET
                    total_jobs_done = user_profiles.total_jobs_done + 1,
                    updated_at = NOW()
            `, [contract.worker_id]);

            // 🚀 AUTO-POST CELEBRATION
            try {
                const { rows: workerProfile } = await client.query('SELECT full_name FROM user_profiles WHERE user_id = $1', [contract.worker_id]);
                const { rows: jobInfo } = await client.query('SELECT title FROM jobs WHERE id = $1', [contract.job_id]);
                
                const workerName = workerProfile[0]?.full_name || 'A talented specialist';
                const jobTitle = jobInfo[0]?.title || 'a specialized project';
                
                const content = `🚀 Mission Accomplished! **${workerName}** just successfully completed the project: **"${jobTitle}"**! 🎊\n\nAnother high-quality delivery on the FAF platform. Great work! 💎`;
                await postService.createPost(contract.worker_id, content);
            } catch (postErr) {
                console.error("Failed to create auto-completion post:", postErr);
            }
        }

        await client.query('COMMIT');
        return result.rows[0];
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

exports.rejectCheckpoint = async ({ checkpointId, clientId, reviewNotes }) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const cpRes = await client.query('SELECT * FROM checkpoints WHERE id = $1', [checkpointId]);
        const cp = cpRes.rows[0];
        if (!cp) throw new Error('CHECKPOINT_NOT_FOUND');
        if (cp.status !== 'SUBMITTED') throw new Error('CHECKPOINT_NOT_SUBMITTED');

        const contractRes = await client.query('SELECT * FROM contracts WHERE id = $1', [cp.contract_id]);
        const contract = contractRes.rows[0];
        if (!contract || contract.client_id != clientId) throw new Error('UNAUTHORIZED');

        const result = await client.query(sql.rejectCheckpoint, [checkpointId, reviewNotes]);
        await client.query('COMMIT');
        return result.rows[0];
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

exports.requestSettlement = async ({ contractId, workerId }) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const contractRes = await client.query('SELECT * FROM contracts WHERE id = $1', [contractId]);
        const contract = contractRes.rows[0];
        if (!contract || contract.worker_id != workerId) throw new Error('UNAUTHORIZED');
        
        const result = await client.query(sql.requestSettlement, [contractId]);
        await client.query('COMMIT');
        return result.rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

exports.finalizeSettlement = async ({ contractId, clientId }) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        
        // 1. Get contract
        const contractRes = await client.query('SELECT * FROM contracts WHERE id = $1', [contractId]);
        const contract = contractRes.rows[0];
        if (!contract) throw new Error('CONTRACT_NOT_FOUND');
        if (contract.client_id != clientId) throw new Error('UNAUTHORIZED');
        
        // 2. Fetch checkpoints
        const checkpointsRes = await client.query('SELECT * FROM checkpoints WHERE contract_id = $1', [contractId]);
        const checkpoints = checkpointsRes.rows;
        
        // 3. Mark remaining checkpoints as CANCELLED
        await client.query(sql.cancelCheckpointsByContract, [contractId]);
        
        // 4. Calculate amount to refund (all non-approved checkpoints)
        const remainingAmount = checkpoints
            .filter(cp => cp.status !== 'APPROVED')
            .reduce((sum, cp) => sum + Number(cp.amount), 0);

        // 5. Refund remaining amount to Client
        if (remainingAmount > 0) {
            const walletService = require("../wallets/wallet.service");
            await walletService.refundLockedFunds(client, {
                userId: clientId,
                amount: remainingAmount,
                referenceId: contractId,
                referenceType: 'CONTRACT_SETTLEMENT'
            });
        }
        
        // 6. Mark contract as COMPLETED
        const updateRes = await client.query(sql.completeContract, [contractId]);
        
        // ✅ Update worker stats: increment total_jobs_done
        await client.query(`
            INSERT INTO user_profiles (user_id, total_jobs_done, updated_at)
            VALUES ($1, 1, NOW())
            ON CONFLICT (user_id) DO UPDATE SET
                total_jobs_done = user_profiles.total_jobs_done + 1,
                updated_at = NOW()
        `, [contract.worker_id]);
        
        // 🚀 AUTO-POST CELEBRATION (Settlement)
        try {
            const { rows: workerProfile } = await client.query('SELECT full_name FROM user_profiles WHERE user_id = $1', [contract.worker_id]);
            const { rows: jobInfo } = await client.query('SELECT title FROM jobs WHERE id = $1', [contract.job_id]);
            
            const workerName = workerProfile[0]?.full_name || 'A talented specialist';
            const jobTitle = jobInfo[0]?.title || 'a specialized project';
            
            const content = `🏁 Project Finalized! **${workerName}** has completed their work on: **"${jobTitle}"**. 🎊\n\nQuality delivered through FAF Secure Escrow. 🛡️`;
            await postService.createPost(contract.worker_id, content);
        } catch (postErr) {
            console.error("Failed to create auto-settlement post:", postErr);
        }

        await client.query('COMMIT');
        return updateRes.rows[0];
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

exports.terminateContract = async ({ contractId, userId }) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Get contract
        const contractRes = await client.query('SELECT * FROM contracts WHERE id = $1', [contractId]);
        const contract = contractRes.rows[0];
        if (!contract) throw new Error('CONTRACT_NOT_FOUND');
        const clientId = contract.client_id;
        
        // Allow either client or worker to terminate
        if (contract.client_id != userId && contract.worker_id != userId) {
            throw new Error('UNAUTHORIZED');
        }

        // 2. Fetch checkpoints
        const checkpointsRes = await client.query('SELECT * FROM checkpoints WHERE contract_id = $1', [contractId]);
        const checkpoints = checkpointsRes.rows;
        
        // 3. Mark contract and pending checkpoints as CANCELLED
        await client.query("UPDATE contracts SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1", [contractId]);
        await client.query("UPDATE checkpoints SET status = 'CANCELLED' WHERE contract_id = $1 AND status = 'PENDING'", [contractId]);

        // 4. Calculate amount to refund (all PENDING checkpoints)
        const pendingCheckpoints = checkpoints.filter(cp => cp.status === 'PENDING');
        const refundAmount = pendingCheckpoints.reduce((sum, cp) => sum + Number(cp.amount), 0);

        // 5. Refund remaining amount to Client
        if (refundAmount > 0) {
            const walletService = require("../wallets/wallet.service");
            await walletService.refundLockedFunds(client, {
                userId: clientId,
                amount: refundAmount,
                referenceId: contractId,
                referenceType: 'CONTRACT_TERMINATION'
            });
        }

        // 6. Job Re-opening: Update Job Status to OPEN
        await client.query("UPDATE jobs SET status = 'OPEN', updated_at = NOW() WHERE id = $1", [contract.job_id]);

        // 7. Reset worker's ACCEPTED proposal back to PENDING (so worker is free again)
        if (contract.worker_id) {
            await client.query(`
                UPDATE proposals
                SET status = 'PENDING', updated_at = NOW()
                WHERE job_id = $1 AND worker_id = $2 AND status = 'ACCEPTED'
            `, [contract.job_id, contract.worker_id]);
        }

        // 8. Create New DRAFT Contract for Remaining Work
        if (pendingCheckpoints.length > 0) {
            // Create Contract
             const newContractRes = await client.query(`
                INSERT INTO contracts (
                    job_id, client_id, contract_type,
                    total_amount, contract_content, status, created_at
                )
                VALUES ($1, $2, 'ESCROW', $3, $4, 'DRAFT', NOW())
                RETURNING *
            `, [contract.job_id, clientId, refundAmount, contract.contract_content]);
            const newContract = newContractRes.rows[0];

            // Create Checkpoints
            for (const cp of pendingCheckpoints) {
                await client.query(`
                    INSERT INTO checkpoints (
                        contract_id, title, description,
                        amount, due_date, status, created_at
                    )
                    VALUES ($1, $2, $3, $4, $5, 'PENDING', NOW())
                `, [newContract.id, cp.title, cp.description, cp.amount, cp.due_date]);
            }
        }

        await client.query('COMMIT');
        return { message: "Contract terminated, funds refunded, and job re-opened with remaining work." };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

