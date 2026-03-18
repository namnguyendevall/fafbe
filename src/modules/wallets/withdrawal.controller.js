const pool = require('../../config/database');
const walletSql = require('./wallet.sql');
const walletService = require('./wallet.service');

exports.requestWithdrawal = async (req, res) => {
    const client = await pool.connect();
    try {
        const { amount, bank_info } = req.body;
        const userId = req.user.id;

        if (!amount || amount <= 0) {
            return res.status(400).json({ message: "Số điểm không hợp lệ" });
        }

        if (!bank_info || typeof bank_info !== 'object') {
            return res.status(400).json({ message: "Thông tin ngân hàng không hợp lệ" });
        }

        await client.query('BEGIN');

        // 1. Check balance and lock funds (actually we deduct for withdrawal)
        // We'll use a dedicated WITHDRAW type in transactions
        const walletRes = await client.query(walletSql.getByUserId, [userId]);
        const wallet = walletRes.rows[0];

        if (!wallet || Number(wallet.balance_points) < amount) {
            throw new Error("INSUFFICIENT_BALANCE");
        }

        // 2. Deduct from balance
        await client.query(`
            UPDATE wallets 
            SET balance_points = balance_points - $2, updated_at = NOW()
            WHERE user_id = $1
        `, [userId, amount]);

        // 3. Create Withdrawal Request
        const withdrawalRes = await client.query(walletSql.createWithdrawalRequest, [
            userId, amount, JSON.stringify(bank_info)
        ]);
        const withdrawal = withdrawalRes.rows[0];

        // 4. Create Transaction Log (PENDING)
        const method = bank_info.method === 'momo' ? 'MoMo' : 'Ngân hàng';
        const description = `Rút ${amount} CRED qua ${method}`;
        
        await client.query(walletSql.createTransaction, [
            wallet.id, 'WITHDRAW', amount, 'PENDING', 'WITHDRAWAL_REQUEST', withdrawal.id, description
        ]);

        await client.query('COMMIT');
        return res.status(201).json({ message: "Yêu cầu rút tiền đã được gửi", data: withdrawal });

    } catch (e) {
        if (client) await client.query('ROLLBACK');
        console.error(e);
        if (e.message === "INSUFFICIENT_BALANCE") {
            return res.status(400).json({ message: "Số dư không đủ để thực hiện giao dịch" });
        }
        return res.status(500).json({ message: "Internal server error" });
    } finally {
        if (client) client.release();
    }
};

exports.listRequests = async (req, res) => {
    try {
        if (!['admin', 'manager'].includes(req.user.role?.toLowerCase())) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const { rows } = await pool.query(walletSql.listWithdrawalRequests);
        return res.json({ data: rows });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ message: "Internal server error" });
    }
};

exports.processRequest = async (req, res) => {
    const client = await pool.connect();
    try {
        if (!['admin', 'manager'].includes(req.user.role?.toLowerCase())) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        const { id } = req.params;
        const { status, admin_note, proof_image_url } = req.body; // APPROVED or REJECTED

        if (!['APPROVED', 'REJECTED'].includes(status)) {
            return res.status(400).json({ message: `Trạng thái không hợp lệ: ${status}` });
        }

        await client.query('BEGIN');

        // 1. Get Request
        const requestRes = await client.query(walletSql.getWithdrawalRequestById, [id]);
        const request = requestRes.rows[0];

        if (!request) throw new Error("REQUEST_NOT_FOUND");
        
        // If already processed, we only allow updating notes/proof if the status is the same
        if (request.status !== 'PENDING') {
            if (request.status === status) {
                // Just update the note and proof image
                await client.query(
                    'UPDATE withdrawal_requests SET admin_note = $2, proof_image_url = $3, updated_at = NOW() WHERE id = $1',
                    [id, admin_note || request.admin_note, proof_image_url || request.proof_image_url]
                );
                await client.query('COMMIT');
                return res.json({ message: "Cập nhật ghi chú và minh chứng thành công" });
            }
            throw new Error("ALREADY_PROCESSED");
        }

        // 2. Update Status (Normal Pending -> Processed flow)
        await client.query(walletSql.updateWithdrawalStatus, [id, status, admin_note || '', proof_image_url || null]);

        // 3. Update Transaction Log & Wallet if REJECTED
        const walletRes = await client.query(walletSql.getByUserId, [request.user_id]);
        const wallet = walletRes.rows[0];

        if (status === 'REJECTED') {
            // Refund points
            await client.query(`
                UPDATE wallets SET balance_points = balance_points + $2, updated_at = NOW()
                WHERE id = $1
            `, [wallet.id, request.amount]);

            await client.query(walletSql.createTransaction, [
                wallet.id, 'REFUND', request.amount, 'SUCCESS', 'WITHDRAWAL_REJECTION', id
            ]);
            
            // Update the original pending transaction to FAILED/REJECTED
            await client.query(`
                UPDATE transactions SET status = 'FAILED' 
                WHERE reference_type = 'WITHDRAWAL_REQUEST' AND reference_id = $1
            `, [id]);
        } else {
            // Success
            await client.query(`
                UPDATE transactions SET status = 'SUCCESS' 
                WHERE reference_type = 'WITHDRAWAL_REQUEST' AND reference_id = $1
            `, [id]);
        }

        await client.query('COMMIT');
        return res.json({ message: `Yêu cầu đã được ${status === 'APPROVED' ? 'chấp nhận' : 'từ chối'}` });

    } catch (e) {
        if (client) await client.query('ROLLBACK');
        console.error("DEBUG ERROR processRequest:", e);
        if (e.message === "REQUEST_NOT_FOUND") return res.status(404).json({ message: "Yêu cầu không tồn tại" });
        if (e.message === "ALREADY_PROCESSED") return res.status(400).json({ message: "Yêu cầu đã được xử lý trước đó hoặc không còn ở trạng thái PENDING" });
        return res.status(500).json({ message: e.message || "Internal server error" });
    } finally {
        if (client) client.release();
    }
};

exports.getMyRequests = async (req, res) => {
    try {
        const { rows } = await pool.query(`
            SELECT * FROM withdrawal_requests 
            WHERE user_id = $1 
            ORDER BY created_at DESC
        `, [req.user.id]);
        return res.json({ data: rows });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ message: "Internal server error" });
    }
};
