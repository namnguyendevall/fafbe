const express = require('express');
const router = express.Router();
const walletController = require('./wallet.controller');
const zalopayController = require('./zalopay.controller');
const withdrawalController = require('./withdrawal.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

// ===== MoMo Routes =====
router.post('/deposit/momo', authMiddleware, walletController.depositMomo);
router.post('/deposit/momo/ipn', walletController.momoIpn);

// ===== ZaloPay Routes =====
router.post('/deposit/zalopay', authMiddleware, zalopayController.depositZaloPay);
router.post('/deposit/zalopay/callback', zalopayController.zalopayCallback);

// ===== Withdrawal Routes =====
router.post('/withdraw/request', authMiddleware, withdrawalController.requestWithdrawal);
router.get('/withdraw/list', authMiddleware, withdrawalController.listRequests);
router.get('/withdraw/my', authMiddleware, withdrawalController.getMyRequests);
router.patch('/withdraw/:id/process', authMiddleware, withdrawalController.processRequest);

// ===== Transaction Routes =====
router.get('/transactions/my', authMiddleware, walletController.listMyTransactions);
router.get('/check-status/zalopay/:app_trans_id', authMiddleware, zalopayController.checkStatus);
router.get('/check-status/momo/:orderId', authMiddleware, walletController.checkStatus);

module.exports = router;
