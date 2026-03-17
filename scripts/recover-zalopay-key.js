const crypto = require('crypto');

const baseKey = "kLtgPl8HHhfvMuDHPwKfgfsY4Vu/kZa"; // 31 chars
// Test with common suffixes
const testKeys = [
    baseKey,
    baseKey + "=",
    "trMrHpaQOO6H6sSl5EAtS64DW7Hs9p98", // default sandbox
    "eG4v09680v3V6688", // another common sandbox key
    "PcY4iZIKFCIdgZvA6ueMcMHHUbRLYjPL", // Key1
];

/**
 * The raw data string from the log:
 * \"app_id\":2553,\"app_trans_id\":\"260317_1_762062\",\"app_time\":1773749931296,\"app_user\":\"user_1\",\"amount\":100000,\"embed_data\":\"{\\\"redirecturl\\\":\\\"https://fafwebv1.vercel.app/wallet/deposit/result\\\"}\",\"item\":\"[{\\\"itemid\\\":\\\"FAF_CRED\\\",\\\"itemname\\\":\\\"Nạp 100 CRED vào ví FAF\\\",\\\"itemprice\\\":100000,\\\"itemquantity\\\":1}]\",\"zp_trans_id\":260317000002595,\"server_time\":1773749951879,\"channel\":39,\"merchant_user_id\":\"DXp3vtfyygtb2_XdP8yFeA\",\"zp_user_id\":\"DXp3vtfyygtb2_XdP8yFeA\",\"user_fee_amount\":0,\"discount_amount\":0}
 * Note: I should ensure no trailing/leading whitespace or weird chars.
 */
const data = "{\"app_id\":2553,\"app_trans_id\":\"260317_1_762062\",\"app_time\":1773749931296,\"app_user\":\"user_1\",\"amount\":100000,\"embed_data\":\"{\\\"redirecturl\\\":\\\"https://fafwebv1.vercel.app/wallet/deposit/result\\\"}\",\"item\":\"[{\\\"itemid\\\":\\\"FAF_CRED\\\",\\\"itemname\\\":\\\"Nạp 100 CRED vào ví FAF\\\",\\\"itemprice\\\":100000,\\\"itemquantity\\\":1}]\",\"zp_trans_id\":260317000002595,\"server_time\":1773749951879,\"channel\":39,\"merchant_user_id\":\"DXp3vtfyygtb2_XdP8yFeA\",\"zp_user_id\":\"DXp3vtfyygtb2_XdP8yFeA\",\"user_fee_amount\":0,\"discount_amount\":0}";

const expectedMac = "d7c84b0bf048144a4b27b731f5a4ee1b3edd23a6d7662a388a78fa1f805adacb";

for (let key of testKeys) {
    const calc = crypto.createHmac('sha256', key).update(data).digest('hex');
    console.log(`Key: ${key.padEnd(35)} -> ${calc}`);
    if (calc === expectedMac) console.log('MATCH FOUND!');
}
