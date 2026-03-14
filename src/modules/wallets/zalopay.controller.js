const CryptoJS = require('crypto-js');
const axios = require('axios');
const pool = require('../../config/database');
const walletSql = require('./wallet.sql');
const moment = require('moment');

const config = {
    app_id: process.env.ZALOPAY_APP_ID,
    key1: process.env.ZALOPAY_KEY1,
    key2: process.env.ZALOPAY_KEY2,
    endpoint: process.env.ZALOPAY_ENDPOINT || 'https://sb-openapi.zalopay.vn/v2/create',
    callback_url: process.env.ZALOPAY_CALLBACK_URL,
    redirect_url: process.env.ZALOPAY_REDIRECT_URL,
    exchangeRate: parseInt(process.env.POINT_EXCHANGE_RATE || '1000', 10)
};

// reference_id column is INTEGER in DB. Create a stable numeric ID from the ZaloPay string transID
// e.g. "260308_245_6099638" -> 6099638 (last numeric segment)
function parseNumericRefId(zptransid) {
    if (!zptransid) return null;
    const parts = zptransid.toString().split('_');
    const lastPart = parseInt(parts[parts.length - 1], 10);
    return isNaN(lastPart) ? null : lastPart;
}

/**
 * Dev/test workaround: when ZaloPay can't reach localhost for callback,
 * DepositResult.jsx calls this endpoint after detecting a successful redirect.
 * In production this should NOT exist - rely on callback only.
 */
exports.creditAfterRedirect = async (req, res) => {
    try {
        const userId = req.user.id;
        const { amount, zptransid } = req.body;
        
        console.log('ZaloPay creditAfterRedirect request:', { userId, amount, zptransid });

        if (!amount || !zptransid) {
            return res.status(400).json({ message: 'Missing amount or transaction id' });
        }

        const pointsToAdd = Math.floor(amount / config.exchangeRate);
        
        // ZaloPay redirect may send apptransid (our string) or zptransid (their numeric string)
        // If it's our string format 'YYMMDD_USERID_RAND', we extract the RAND part.
        // If it's just a long numeric string, we treat it as the numeric ID directly.
        let numericRefId;
        if (zptransid.toString().includes('_')) {
            numericRefId = parseNumericRefId(zptransid);
        } else {
            numericRefId = parseInt(zptransid, 10);
            if (isNaN(numericRefId)) numericRefId = null;
        }

        if (!numericRefId) {
            console.error('Invalid transaction id format:', zptransid);
            return res.status(400).json({ message: 'Invalid transaction id format' });
        }
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // Idempotency: skip if already processed
            const existing = await client.query(
                'SELECT id FROM transactions WHERE reference_id = $1 AND reference_type = $2',
                [numericRefId, 'ZALOPAY_DEPOSIT']
            );

            if (existing.rows.length > 0) {
                await client.query('ROLLBACK');
                return res.json({ message: 'Already credited', skipped: true });
            }

            await client.query(walletSql.updateBalance, [userId, pointsToAdd]);

            const walletRes = await client.query(walletSql.getByUserId, [userId]);
            const walletId = walletRes.rows[0]?.id;
            if (walletId) {
                await client.query(walletSql.createTransaction, [
                    walletId, 'DEPOSIT', pointsToAdd, 'SUCCESS', 'ZALOPAY_DEPOSIT', numericRefId
                ]);
            }

            await client.query('COMMIT');
            return res.json({ message: 'Credited successfully', points: pointsToAdd });
        } catch (err) {
            await client.query('ROLLBACK');
            console.error('creditAfterRedirect DB error details:', {
                message: err.message,
                detail: err.detail,
                code: err.code,
                stack: err.stack
            });
            return res.status(500).json({ message: 'DB error', details: err.message });
        } finally {
            client.release();
        }
    } catch (e) {
        console.error('creditAfterRedirect error:', e);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

exports.depositZaloPay = async (req, res) => {
    try {
        const { amount } = req.body;
        const userId = req.user.id;

        if (!amount || amount <= 0) {
            return res.status(400).json({ message: 'Invalid amount' });
        }

        const amountVnd = Math.floor(amount * config.exchangeRate);

        if (amountVnd < 1000) {
            return res.status(400).json({ message: 'Số CRED tối thiểu là 1 CRED (tương đương 1,000 VND).' });
        }

        const transID = Math.floor(Math.random() * 1000000);
        const app_trans_id = `${moment().format('YYMMDD')}_${userId}_${transID}`;

        const embed_data = JSON.stringify({
            redirecturl: config.redirect_url
        });

        const items = JSON.stringify([
            {
                itemid: 'FAF_CRED',
                itemname: `Nạp ${amount} CRED vào ví FAF`,
                itemprice: amountVnd,
                itemquantity: 1
            }
        ]);

        const order = {
            app_id: parseInt(config.app_id),
            app_trans_id,
            app_user: `user_${userId}`,
            app_time: Date.now(),
            item: items,
            embed_data,
            amount: amountVnd,
            callback_url: config.callback_url,
            description: `FAF - Thanh toán nạp ${amount} CRED`,
            bank_code: '',
        };

        // Build MAC Signature: app_id|app_trans_id|app_user|amount|app_time|embed_data|item
        const data = `${order.app_id}|${order.app_trans_id}|${order.app_user}|${order.amount}|${order.app_time}|${order.embed_data}|${order.item}`;
        order.mac = CryptoJS.HmacSHA256(data, config.key1).toString();

        const result = await axios.post(config.endpoint, null, { params: order });

        if (result.data && result.data.return_code === 1) {
            return res.json({ order_url: result.data.order_url });
        } else {
            console.error('ZaloPay Create Order Error:', result.data);
            return res.status(500).json({ message: 'Failed to create ZaloPay order', data: result.data });
        }
    } catch (e) {
        console.error('ZaloPay deposit error:', e);
        return res.status(500).json({ message: 'Internal server error' });
    }
};

exports.zalopayCallback = async (req, res) => {
    let result = {};
    try {
        const { data: dataStr, mac: reqMac } = req.body;

        // Verify signature
        const mac = CryptoJS.HmacSHA256(dataStr, config.key2).toString();

        if (mac !== reqMac) {
            result = { return_code: -1, return_message: 'Invalid MAC' };
        } else {
            const dataJson = JSON.parse(dataStr);

            // Extract userId from app_user (e.g. "user_75")
            const userId = dataJson.app_user.replace('user_', '');
            const amountVnd = dataJson.amount;
            const pointsToAdd = Math.floor(amountVnd / config.exchangeRate);
            const transId = dataJson.zp_trans_id.toString();
            const numericRefId = parseNumericRefId(transId);
            if (!numericRefId) throw new Error('Invalid zp_trans_id format');

            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                // Idempotency check
                const existing = await client.query(
                    'SELECT id FROM transactions WHERE reference_id = $1 AND reference_type = $2',
                    [numericRefId, 'ZALOPAY_DEPOSIT']
                );

                if (existing.rows.length === 0) {
                    await client.query(walletSql.updateBalance, [userId, pointsToAdd]);

                    const walletRes = await client.query(walletSql.getByUserId, [userId]);
                    const walletId = walletRes.rows[0]?.id;

                    if (walletId) {
                        await client.query(walletSql.createTransaction, [
                            walletId, 'DEPOSIT', pointsToAdd, 'SUCCESS', 'ZALOPAY_DEPOSIT', numericRefId
                        ]);
                    }
                }

                await client.query('COMMIT');
                result = { return_code: 1, return_message: 'success' };
            } catch (err) {
                await client.query('ROLLBACK');
                console.error('Error processing ZaloPay callback DB update:', err);
                result = { return_code: 0, return_message: 'DB error' };
            } finally {
                client.release();
            }
        }
    } catch (ex) {
        console.error('ZaloPay callback exception:', ex.message);
        result = { return_code: 0, return_message: ex.message };
    }

    return res.json(result);
};
