const crypto = require('crypto');

const key1 = "PcY4iZIKFCIdgZvA6ueMcMHHUbRLYjPL";
const key2 = "kLtgPl8HHhfvMuDHPwKfgfsY4Vu/kZa"; // User's key (31 chars?)
const commonKey2 = "trMrHpaQOO6H6sSl5EAtS64DW7Hs9p98"; // Common sandbox key

const data = "{\"app_id\":2553,\"app_trans_id\":\"260317_1_762062\",\"app_time\":1773749931296,\"app_user\":\"user_1\",\"amount\":100000,\"embed_data\":\"{\\\"redirecturl\\\":\\\"https://fafwebv1.vercel.app/wallet/deposit/result\\\"}\",\"item\":\"[{\\\"itemid\\\":\\\"FAF_CRED\\\",\\\"itemname\\\":\\\"Nạp 100 CRED vào ví FAF\\\",\\\"itemprice\\\":100000,\\\"itemquantity\\\":1}]\",\"zp_trans_id\":260317000002595,\"server_time\":1773749951879,\"channel\":39,\"merchant_user_id\":\"DXp3vtfyygtb2_XdP8yFeA\",\"zp_user_id\":\"DXp3vtfyygtb2_XdP8yFeA\",\"user_fee_amount\":0,\"discount_amount\":0}";

const expectedMac = "d7c84b0bf048144a4b27b731f5a4ee1b3edd23a6d7662a388a78fa1f805adacb";

const calc2 = crypto.createHmac('sha256', key2).update(data).digest('hex');
const calcCommon = crypto.createHmac('sha256', commonKey2).update(data).digest('hex');

console.log('Using Key2:       ', calc2);
console.log('Using Common Key2:', calcCommon);
console.log('Expected:         ', expectedMac);
