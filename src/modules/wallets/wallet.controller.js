const crypto = require('crypto');
const axios = require('axios');
const pool = require('../../config/database');
const walletSql = require('./wallet.sql');

// Env configurations
const config = {
    partnerCode: process.env.MOMO_PARTNER_CODE?.replace(/"/g, '').trim(),
    accessKey: process.env.MOMO_ACCESS_KEY?.replace(/"/g, '').trim(),
    secretKey: process.env.MOMO_SECRET_KEY?.replace(/"/g, '').trim(),
    endpoint: process.env.MOMO_ENDPOINT?.replace(/"/g, '').trim(),
    redirectUrl: process.env.MOMO_REDIRECT_URL?.replace(/"/g, '').trim(),
    ipnUrl: process.env.MOMO_IPN_URL?.replace(/"/g, '').trim(),
    exchangeRate: parseInt(process.env.POINT_EXCHANGE_RATE || "1000", 10)
};

exports.depositMomo = async (req, res) => {
    try {
        const { amount } = req.body;
        const userId = req.user.id;

        if (!amount || amount <= 0) {
            return res.status(400).json({ message: "Invalid amount" });
        }

        // FAF Points to VND Conversion
        // MoMo requires minimum 1000 VND
        // Default rate: 1 CRED = 1000 VND (unless otherwise set in env)
        const exchangeRate = parseInt(process.env.POINT_EXCHANGE_RATE || "1000", 10);
        const amountVnd = Math.floor(amount * exchangeRate);
        
        if (amountVnd < 1000) {
            return res.status(400).json({ message: "Số CRED tối thiểu là 1 CRED (tương đương 1,000 VND) để nạp qua MoMo." });
        }
        const orderInfo = `Nap tien vao vi FAF (${amount} CRED)`;
        const orderId = `deposit_${userId}_${Date.now()}`;
        const requestId = orderId;
        const requestType = "captureWallet";
        const extraData = ""; // optional

        // Format raw signature string
        const rawSignature = `accessKey=${config.accessKey}&amount=${amountVnd}&extraData=${extraData}&ipnUrl=${config.ipnUrl}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${config.partnerCode}&redirectUrl=${config.redirectUrl}&requestId=${requestId}&requestType=${requestType}`;

        // Create HMAC SHA256 Signature
        const signature = crypto.createHmac('sha256', config.secretKey)
                                .update(rawSignature)
                                .digest('hex');

        // Request body to send to MoMo
        const requestBody = {
            partnerCode: config.partnerCode,
            partnerName: "FAF",
            storeId: "FAF",
            requestId: requestId,
            amount: amountVnd,
            orderId: orderId,
            orderInfo: orderInfo,
            redirectUrl: config.redirectUrl,
            ipnUrl: config.ipnUrl,
            lang: "vi",
            requestType: requestType,
            autoCapture: true,
            extraData: extraData,
            signature: signature
        };

        const result = await axios.post(config.endpoint, requestBody);

        if (result.data && result.data.payUrl) {
            // Optional: You could insert a PENDING transaction here into db before returning
            return res.json({ payUrl: result.data.payUrl });
        } else {
            console.error("MoMo Create Payment Error:", result.data);
            return res.status(500).json({ message: "Failed to generate MoMo payment URL", data: result.data });
        }
    } catch (e) {
        console.error("Momo deposit error:", e);
        return res.status(500).json({ message: "Internal server error" });
    }
};

exports.momoIpn = async (req, res) => {
    try {
        console.log('[MOMO IPN] Received Body:', JSON.stringify(req.body));
        const {
            partnerCode, orderId, requestId, amount, orderInfo, orderType, transId,
            resultCode, message, payType, responseTime, extraData, signature
        } = req.body;

        // Verify signature
        const rawSignature = `accessKey=${config.accessKey}&amount=${amount}&extraData=${extraData}&message=${message}&orderId=${orderId}&orderInfo=${orderInfo}&orderType=${orderType}&partnerCode=${partnerCode}&payType=${payType}&requestId=${requestId}&responseTime=${responseTime}&resultCode=${resultCode}&transId=${transId}`;
        
        const expectedSignature = crypto.createHmac('sha256', config.secretKey)
                                        .update(rawSignature)
                                        .digest('hex');

        console.log('[MOMO IPN] Expected Signature:', expectedSignature);
        console.log('[MOMO IPN] Request Signature:', signature);

        if (signature !== expectedSignature) {
            console.warn("[MOMO IPN] Invalid signature verification");
            return res.status(400).json({ message: "Invalid signature" });
        }

        if (resultCode === 0) { // Success
            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                const parts = orderId.split('_');
                const userId = parts[1].trim();
                const pointsToAdd = Math.floor(amount / config.exchangeRate);
                const sTransId = transId.toString();

                console.log(`[MOMO IPN] Processing: UserID="${userId}", Points=${pointsToAdd}, TransId=${sTransId}`);

                const txCheck = await client.query('SELECT id FROM transactions WHERE reference_id = $1 AND reference_type = $2', [sTransId, 'MOMO_DEPOSIT']);
                
                if (txCheck.rows.length === 0) {
                    let updateRes = await client.query(walletSql.updateBalance, [userId, pointsToAdd]);
                    
                    if (updateRes.rowCount === 0) {
                        console.log(`[MOMO IPN] No wallet found for user ${userId}, attempting to create...`);
                        const userCheck = await client.query('SELECT id FROM users WHERE id = $1', [userId]);
                        if (userCheck.rows.length > 0) {
                            await client.query('INSERT INTO wallets (user_id, balance_points) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET balance_points = wallets.balance_points + $2', [userId, pointsToAdd]);
                            console.log(`[MOMO IPN] Wallet created/updated for user ${userId}`);
                        } else {
                            console.error(`[MOMO IPN] User ${userId} NOT found in database!`);
                            throw new Error(`User ${userId} does not exist`);
                        }
                    } else {
                        console.log(`[MOMO IPN] Balance updated for user ${userId}`);
                    }

                    const walletRes = await client.query(walletSql.getByUserId, [userId]);
                    const walletId = walletRes.rows[0]?.id;
                    
                    if (walletId) {
                        await client.query(walletSql.createTransaction, [
                            walletId, 'DEPOSIT', pointsToAdd, 'SUCCESS', 'MOMO_DEPOSIT', sTransId
                        ]);
                        console.log('[MOMO IPN] Transaction record created');
                    }
                } else {
                    console.log('[MOMO IPN] Transaction already processed (idempotency)');
                }

                await client.query('COMMIT');
            } catch (err) {
                await client.query('ROLLBACK');
                console.error("[MOMO IPN] DB Error:", err);
            } finally {
                client.release();
            }
        } else {
            console.log('[MOMO IPN] Payment failed with resultCode:', resultCode);
        }

        return res.status(204).send();
    } catch (e) {
        console.error("[MOMO IPN] General Exception:", e);
        return res.status(500).send();
    }
};

exports.listMyTransactions = async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await pool.query(walletSql.listMyTransactions, [userId]);
        return res.json({ data: result.rows });
    } catch (e) {
        console.error("Error listing transactions:", e);
        return res.status(500).json({ message: "Internal server error" });
    }
};
