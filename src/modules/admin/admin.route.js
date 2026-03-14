const express = require('express');
const router = express.Router();
const controller = require('./admin.controller');
const auth = require('../../middlewares/auth.middleware');
const checkRole = require('../../middlewares/role.middleware');

const isManagerOrAdmin = checkRole(['admin', 'manager']);
const isAdmin = checkRole(['admin']);

// Existing routes with improved protection
router.get('/jobs/pending', auth, isManagerOrAdmin, controller.getPendingJobs);
router.get('/jobs/all', auth, isManagerOrAdmin, controller.getAllJobs);
router.put('/jobs/:id/approve', auth, isManagerOrAdmin, controller.approveJob);
router.put('/jobs/:id/reject', auth, isManagerOrAdmin, controller.rejectJob);
router.get('/stats', auth, isManagerOrAdmin, controller.getDashboardStats);
router.get('/financials', auth, isManagerOrAdmin, controller.getFinancialOverview);
router.get('/users', auth, isManagerOrAdmin, controller.listAllUsers);
router.patch('/users/:id/role', auth, isAdmin, controller.updateUserRoleHandler);
router.get('/transactions', auth, isManagerOrAdmin, controller.getTransactions);
router.get('/management/jobs', auth, isManagerOrAdmin, controller.getJobsManagement);

// New Dashboard & Stats Routes
router.get('/stats/jobs', auth, isManagerOrAdmin, controller.getJobStats);

// Manager Management (Admin Only)
router.post('/managers', auth, isAdmin, controller.createManager);

// Category Proposals
router.get('/categories/proposals', auth, isManagerOrAdmin, controller.listCategoryProposals);
router.put('/categories/proposals/:id/approve', auth, isAdmin, controller.approveCategoryProposal);
router.put('/categories/proposals/:id/reject', auth, isAdmin, controller.rejectCategoryProposal);

// Admin Notifications
router.get('/notifications', auth, isAdmin, controller.listAdminNotifications);
router.patch('/notifications/:id/read', auth, isAdmin, controller.markNotificationRead);

module.exports = router;

