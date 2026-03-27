const pool = require("../../config/database");
const sql = require("./dispute.sql");

exports.createDispute = async ({ contractId, checkpointId, userId, reason }) => {
    const client = await pool.connect();
    try {
        const contractRes = await client.query('SELECT * FROM contracts WHERE id = $1', [contractId]);
        const contract = contractRes.rows[0];
        if (!contract) throw new Error("CONTRACT_NOT_FOUND");
        
        if (contract.client_id !== userId && contract.worker_id !== userId) {
            throw new Error("UNAUTHORIZED");
        }

        // Validate checkpoint
        const cpRes = await client.query('SELECT * FROM checkpoints WHERE id = $1 AND contract_id = $2', [checkpointId, contractId]);
        const checkpoint = cpRes.rows[0];
        if (!checkpoint) throw new Error("CHECKPOINT_NOT_FOUND");
        if (checkpoint.status !== 'REJECTED' && checkpoint.status !== 'SUBMITTED') {
            throw new Error("Chỉ có thể khiếu nại các checkpoint đã bị từ chối hoặc chưa được duyệt");
        }

        // Check if dispute already exists for this checkpoint
        const existingDisputeRes = await client.query('SELECT id FROM disputes WHERE checkpoint_id = $1', [checkpointId]);
        if (existingDisputeRes.rows.length > 0) {
            throw new Error("Mỗi giai đoạn chỉ được phép khiếu nại một lần.");
        }

        const deadline = new Date();
        deadline.setHours(deadline.getHours() + 24); // 24h deadline for Employer to resolve

        const { rows } = await client.query(sql.create, [contractId, checkpointId, userId, reason, deadline]);
        const dispute = rows[0];
        
        // Update Checkpoint Status to DISPUTED
        await client.query("UPDATE checkpoints SET status = 'DISPUTED' WHERE id = $1", [checkpointId]);
        
        // Update Contract and Job Status to DISPUTED
        await client.query("UPDATE contracts SET status = 'DISPUTED' WHERE id = $1", [contractId]);
        await client.query("UPDATE jobs SET status = 'DISPUTED' WHERE id = $1", [contract.job_id]);

        
        // Notify other party + Admin
        // Identify other party
        const otherPartyId = (userId === contract.client_id) ? contract.worker_id : contract.client_id;
        
        // Notify Other Party
        // WE need Io instance. Assuming integration later or passed in? 
        // For now, let controller handle notification or we import singleton if possible?
        // Service generally shouldn't depend on Controller stuff.
        // We will return dispute and let controller notify.
        
        return dispute;
    } finally {
        client.release();
    }
};

exports.getDispute = async (disputeId, userId) => {
    const { rows } = await pool.query(sql.getById, [disputeId]);
    const dispute = rows[0];
    if (!dispute) return null;
    
    // Check permission (Client, Worker)
    const contractRes = await pool.query('SELECT * FROM contracts WHERE id = $1', [dispute.contract_id]);
    const contract = contractRes.rows[0];
    
    if (contract.client_id !== userId && contract.worker_id !== userId) {
         return null; // Not a participant
    }
    
    const msgRes = await pool.query(sql.getMessages, [disputeId]);
    dispute.messages = msgRes.rows;
    
    return dispute;
};

/**
 * Get dispute details without participant check (for Managers/Admins)
 */
exports.getDisputeAdmin = async (disputeId) => {
    const { rows } = await pool.query(sql.getById, [disputeId]);
    const dispute = rows[0];
    if (!dispute) return null;
    
    const msgRes = await pool.query(sql.getMessages, [disputeId]);
    dispute.messages = msgRes.rows;
    
    return dispute;
};

exports.listAll = async () => {
    const { rows } = await pool.query(sql.listAll);
    return rows;
};

exports.listByUser = async (userId) => {
    const { rows } = await pool.query(sql.listByUser, [userId]);
    return rows;
};


exports.addMessage = async ({ disputeId, userId, message, attachments }) => {
     const { rows } = await pool.query(sql.addMessage, [disputeId, userId, message, attachments || []]);
     return rows[0];
};

exports.resolveDispute = async ({ disputeId, resolution, adminId, io, resolutionSummary }) => {
    const notificationService = require('../notifications/notification.service');
    const client = await pool.connect();
    try {
        console.log(`[DisputeResolve] Resolving Dispute #${disputeId}...`, { hasNotificationService: !!notificationService });
        await client.query('BEGIN');
        
        // 1. Fetch Dispute & Contract
        const disputeRes = await client.query(sql.getById, [disputeId]);
        const dispute = disputeRes.rows[0];
        if (!dispute) throw new Error("DISPUTE_NOT_FOUND");
        
        const contractRes = await client.query('SELECT * FROM contracts WHERE id = $1', [dispute.contract_id]);
        const contract = contractRes.rows[0];
        if (!contract) throw new Error("CONTRACT_NOT_FOUND");
        // 2. Fetch Disputed Checkpoint Details
        let cp = null;
        let pendingPoints = 0;

        if (dispute.checkpoint_id) {
            const cpRes = await client.query('SELECT * FROM checkpoints WHERE id = $1', [dispute.checkpoint_id]);
            cp = cpRes.rows[0];
            if (!cp) throw new Error("CHECKPOINT_NOT_FOUND");
            pendingPoints = Number(cp.amount);
            console.log(`[DisputeResolve] pendingPoints for CP ${cp.id}:`, pendingPoints);
        } else {
            console.log(`[DisputeResolve] No specific checkpoint_id. Handling as contract-level dispute.`);
        }
            
        // 3. Handle Resolution
        if (resolution === 'CLIENT_WINS') {
            // Worker loses -> Check if redo is possible (limit < 3)
            if (cp && Number(cp.rework_count) < 3) {
                console.log(`[DisputeResolve] Resolution: CLIENT_WINS (Worker must redo, rework_count: ${cp.rework_count})`);
                
                // Set checkpoint back to REJECTED and increment rework_count so worker can try again
                await client.query("UPDATE checkpoints SET status = 'REJECTED', rework_count = rework_count + 1, updated_at = NOW() WHERE id = $1", [cp.id]);
                
                // Keep contract ACTIVE
                await client.query("UPDATE contracts SET status = 'ACTIVE' WHERE id = $1", [contract.id]);
                await client.query("UPDATE jobs SET status = 'IN_PROGRESS' WHERE id = $1", [contract.job_id]);
                
                // Funds remain locked (already handled by not releasing them)
            } else {
                console.log("[DisputeResolve] Resolution: CLIENT_WINS (Final Failure or No CP - Rework Limit Reached)");
                // Worker loses -> Funds for this CP (if any) go back to Client.
                if (pendingPoints > 0) {
                    const walletService = require("../wallets/wallet.service");
                    console.log(`[DisputeResolve] Refunding pendingPoints ${pendingPoints} to Client ${contract.client_id}`);
                    await walletService.refundLockedFunds(client, {
                        userId: contract.client_id,
                        amount: pendingPoints,
                        referenceId: disputeId,
                        referenceType: 'DISPUTE_RESOLUTION_REFUND'
                    });
                }
                
                // Cancel specific Checkpoint if exists
                if (cp) {
                    await client.query("UPDATE checkpoints SET status = 'CANCELLED' WHERE id = $1", [cp.id]);
                }

                // TERMINATE Contract since worker failed too many times
                await client.query("UPDATE contracts SET status = 'TERMINATED', updated_at = NOW() WHERE id = $1", [contract.id]);
                // RE-OPEN Job
                await client.query("UPDATE jobs SET status = 'OPEN', updated_at = NOW() WHERE id = $1", [contract.job_id]);

                // Reset worker's ACCEPTED proposal so they are no longer "hired" for this job
                await client.query("UPDATE proposals SET status = 'REJECTED', updated_at = NOW() WHERE job_id = $1 AND worker_id = $2", [contract.job_id, contract.worker_id]);

                // Refund ALL remaining non-approved checkpoints for this contract
                const remCps = await client.query("SELECT * FROM checkpoints WHERE contract_id = $1 AND status != 'APPROVED' " + (cp ? `AND id != ${cp.id}` : ""), [contract.id]);
                const remainingRefund = remCps.rows.reduce((sum, r) => sum + Number(r.amount), 0);
                
                if (remainingRefund > 0) {
                    const walletService = require("../wallets/wallet.service");
                    await walletService.refundLockedFunds(client, {
                        userId: contract.client_id,
                        amount: remainingRefund,
                        referenceId: contract.id,
                        referenceType: 'CONTRACT_TERMINATION_REFUND'
                    });
                }
                // Cancel all remaining checkpoints
                await client.query("UPDATE checkpoints SET status = 'CANCELLED' WHERE contract_id = $1 AND status != 'APPROVED'", [contract.id]);
            }
        } else if (resolution === 'WORKER_WINS') {
            console.log("[DisputeResolve] Resolution: WORKER_WINS");
            // Worker wins -> Funds released to Worker.
            if (pendingPoints > 0) {
                const walletService = require("../wallets/wallet.service");
                console.log(`[DisputeResolve] Releasing pendingPoints ${pendingPoints} to Worker ${contract.worker_id}`);
                await walletService.releaseCheckpointFunds(client, {
                    clientId: contract.client_id,
                    workerId: contract.worker_id,
                    amount: pendingPoints,
                    referenceId: disputeId,
                    referenceType: 'DISPUTE_RESOLUTION_RELEASE'
                });
            }
            
            // Approve Checkpoint if exists
            if (cp) {
                await client.query("UPDATE checkpoints SET status = 'APPROVED' WHERE id = $1", [cp.id]);
            } else {
                // If no specific checkpoint, we release all relevant checkpoints.
                 console.log("[DisputeResolve] Approving all PENDING/DISPUTED/SUBMITTED checkpoints for contract-level win");
                 await client.query("UPDATE checkpoints SET status = 'APPROVED' WHERE contract_id = $1 AND status IN ('DISPUTED', 'SUBMITTED', 'PENDING')", [contract.id]);
            }
            
            // Check if all checkpoints are now approved to complete contract
            const allCpsRes = await client.query('SELECT status FROM checkpoints WHERE contract_id = $1', [contract.id]);
            const allApproved = allCpsRes.rows.every(r => r.status === 'APPROVED');

            if (allApproved) {
                console.log("[DisputeResolve] All checkpoints approved. Completing mission.");
                await client.query(`UPDATE contracts SET status = 'COMPLETED', updated_at = NOW() WHERE id = $1`, [contract.id]);
                await client.query(`UPDATE jobs SET status = 'COMPLETED', updated_at = NOW() WHERE id = $1`, [contract.job_id]);
                
                // Add stats for Worker
                await client.query(`
                    INSERT INTO user_profiles (user_id, total_jobs_done, updated_at)
                    VALUES ($1, 1, NOW())
                    ON CONFLICT (user_id) DO UPDATE SET
                        total_jobs_done = user_profiles.total_jobs_done + 1,
                        updated_at = NOW()
                `, [contract.worker_id]);
            } else {
                // Ensure contract remains ACTIVE
                await client.query("UPDATE contracts SET status = 'ACTIVE' WHERE id = $1", [contract.id]);
                await client.query("UPDATE jobs SET status = 'IN_PROGRESS' WHERE id = $1", [contract.job_id]);
            }

        } else {
            throw new Error("INVALID_RESOLUTION_TYPE");
        }
        
        // 4. Update Dispute Status
        const updateDispute = await client.query(sql.updateStatus, [disputeId, 'RESOLVED', resolution, resolutionSummary || '']);
        
        // 5. Notifications
        if (io) {
            // Notify Client
            await notificationService.createNotification({
                userId: contract.client_id,
                type: 'DISPUTE_RESOLVED',
                title: 'Dispute Resolved',
                message: `Dispute #${disputeId} has been resolved: ${resolution}`,
                data: { disputeId, resolution },
                io
            });
            // Notify Worker
            await notificationService.createNotification({
                userId: contract.worker_id,
                type: 'DISPUTE_RESOLVED',
                title: 'Dispute Resolved',
                message: `Dispute #${disputeId} has been resolved: ${resolution}`,
                data: { disputeId, resolution },
                io
            });
        }
        
        await client.query('COMMIT');
        return updateDispute.rows[0];
    } catch (e) {
        await client.query('ROLLBACK');
        throw e;
    } finally {
        client.release();
    }
};

/**
 * Handle Auto-resolution for expired deadlines (Employer silent for > 24h)
 * Called by cron or background job
 */
exports.processAutoResolutions = async (io) => {
    const { rows: expiredDisputes } = await pool.query(`
        SELECT id FROM disputes 
        WHERE status = 'OPEN' AND employer_resolution_deadline < NOW()
    `);

    console.log(`[DisputeAutoResolve] Found ${expiredDisputes.length} disputes to auto-resolve`);

    for (const d of expiredDisputes) {
        try {
            await exports.resolveDispute({
                disputeId: d.id,
                resolution: 'WORKER_WINS',
                adminId: null, // System resolved
                io,
                resolutionSummary: 'Auto-resolved after 24h of Employer silence.'
            });
            console.log(`[DisputeAutoResolve] Auto-resolved Dispute #${d.id}`);
        } catch (err) {
            console.error(`[DisputeAutoResolve] Failed to auto-resolve Dispute #${d.id}:`, err);
        }
    }
};
