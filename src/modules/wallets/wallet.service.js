const pool = require("../../config/database");
const sql = require("./wallet.sql");

/**
 * Get wallet by user ID
 */
exports.getWallet = async (client, userId) => {
    const { rows } = await client.query(sql.getByUserId, [userId]);
    return rows[0];
};

/**
 * Release funds from client's locked points and deposit to worker's balance
 * Handles 5% system fee automatically
 */
exports.releaseCheckpointFunds = async (client, { clientId, workerId, amount, referenceId, referenceType = 'CHECKPOINT' }) => {
    const fee = Math.floor(amount * 0.05);
    const payout = amount - fee;

    // 1. Decrease Client Locked (Full amount)
    const clientWalletUpdate = await client.query(sql.releaseFunds, [clientId, amount]);
    if (clientWalletUpdate.rowCount === 0) throw new Error("INSUFFICIENT_LOCKED_FUNDS");

    // 2. Increase Worker Balance (Net amount)
    await client.query(sql.updateBalance, [workerId, payout]);

    // 3. Log Transactions
    const clientWallet = await exports.getWallet(client, clientId);
    const workerWallet = await exports.getWallet(client, workerId);

    // Client transaction (Full amount release)
    await client.query(sql.createTransaction, [
        clientWallet.id, 'RELEASE', -amount, 'SUCCESS', referenceType, referenceId, `Release funds for ${referenceType} ${referenceId}`
    ]);

    // Worker transaction (Payout amount)
    await client.query(sql.createTransaction, [
        workerWallet.id, 'RELEASE', payout, 'SUCCESS', referenceType, referenceId, `Receive payout for ${referenceType} ${referenceId} (Fee: ${fee})`
    ]);

    return { payout, fee };
};

/**
 * Refund locked funds back to client's balance
 */
exports.refundLockedFunds = async (client, { userId, amount, referenceId, referenceType }) => {
    const updateRes = await client.query(sql.unlockFunds, [userId, amount]);
    if (updateRes.rowCount === 0) throw new Error("INSUFFICIENT_LOCKED_FUNDS");

    const wallet = await exports.getWallet(client, userId);
    await client.query(sql.createTransaction, [
        wallet.id, 'REFUND', amount, 'SUCCESS', referenceType, referenceId, `Refund for ${referenceType} ${referenceId}`
    ]);

    return updateRes.rows[0];
};

/**
 * Lock funds from user balance into locked_points
 */
exports.lockBudget = async (client, { userId, amount, referenceId, referenceType }) => {
    console.log(`[lockBudget] Locking ${amount} for user ${userId}, ref: ${referenceId}`);
    const updateRes = await client.query(sql.lockFunds, [userId, amount]);
    if (updateRes.rowCount === 0) {
        console.error(`[lockBudget] Insufficient balance for user ${userId}`);
        throw new Error("INSUFFICIENT_BALANCE");
    }

    const wallet = await exports.getWallet(client, userId);
    console.log(`[lockBudget] Fetched wallet for user ${userId}:`, wallet);
    
    if (!wallet || !wallet.id) {
        console.error(`[lockBudget] CRITICAL: Wallet or Wallet ID is missing for user ${userId}. Wallet data:`, wallet);
        throw new Error("WALLET_ID_MISSING");
    }

    await client.query(sql.createTransaction, [
        wallet.id, 'LOCK', -amount, 'SUCCESS', referenceType, referenceId, `Lock budget for ${referenceType} ${referenceId}`
    ]);

    return updateRes.rows[0];
};
