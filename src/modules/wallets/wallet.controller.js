const crypto = require('crypto');
const axios = require('axios');
const pool = require('../../config/database');
const walletSql = require('./wallet.sql');

// Env configurations
const config = {
    partnerCode: process.env.MOMO_PARTNER_CODE,
    accessKey: process.env.MOMO_ACCESS_KEY,
    secretKey: process.env.MOMO_SECRET_KEY,
    endpoint: process.env.MOMO_ENDPOINT,
    redirectUrl: process.env.MOMO_REDIRECT_URL,
    ipnUrl: process.env.MOMO_IPN_URL,
    exchangeRate: parseInt(process.env.POINT_EXCHANGE_RATE || "1", 10)
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
        const {
            partnerCode, orderId, requestId, amount, orderInfo, orderType, transId,
            resultCode, message, payType, responseTime, extraData, signature
        } = req.body;

        // Verify signature
        const rawSignature = `accessKey=${config.accessKey}&amount=${amount}&extraData=${extraData}&message=${message}&orderId=${orderId}&orderInfo=${orderInfo}&orderType=${orderType}&partnerCode=${partnerCode}&payType=${payType}&requestId=${requestId}&responseTime=${responseTime}&resultCode=${resultCode}&transId=${transId}`;
        
        const expectedSignature = crypto.createHmac('sha256', config.secretKey)
                                        .update(rawSignature)
                                        .digest('hex');

        if (signature !== expectedSignature) {
            console.warn("Invalid MoMo IPN signature");
            return res.status(400).json({ message: "Invalid signature" });
        }

        if (resultCode === 0) { // Success
            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                // Extract userId from orderId (deposit_{userId}_{timestamp})
                const parts = orderId.split('_');
                const userId = parts[1];

                const pointsToAdd = Math.floor(amount * config.exchangeRate);

                // Check if transaction already processed (to handle duplicate IPNs)
                const txCheck = await client.query('SELECT id FROM transactions WHERE reference_id = $1 AND reference_type = $2', [transId.toString(), 'MOMO_DEPOSIT']);
                if (txCheck.rows.length === 0) {
                    // Update user balance
                    await client.query(walletSql.updateBalance, [userId, pointsToAdd]);
                    
                    // Log transaction
                    const walletRes = await client.query(walletSql.getByUserId, [userId]);
                    const walletId = walletRes.rows[0].id;
                    
                    await client.query(walletSql.createTransaction, [
                        walletId, 'DEPOSIT', pointsToAdd, 'SUCCESS', 'MOMO_DEPOSIT', transId.toString()
                    ]);
                }

                await client.query('COMMIT');
            } catch (err) {
                await client.query('ROLLBACK');
                console.error("Error processing MoMo IPN DB update:", err);
            } finally {
                client.release();
            }
        }

        // Acknowledge MoMo
        return res.status(204).send();
    } catch (e) {
        console.error("Momo IPN general error:", e);
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
