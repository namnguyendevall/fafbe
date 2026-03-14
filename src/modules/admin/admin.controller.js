const s = require("./admin.service");
const notificationService = require('../notifications/notification.service');
const { getJobById } = require('../jobs/job.service');

exports.getPendingJobs = async (req, res) => {
  try {
    const jobs = await s.getPendingJobs();
    return res.json({ data: jobs });
  } catch (error) {
    console.error("ADMIN_ERROR [getJobsManagement]:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

exports.getAllJobs = async (req, res) => {
  try {
    const jobs = await s.getAllJobs();
    return res.json({ data: jobs });
  } catch (error) {
    console.error("ADMIN_ERROR [getJobsManagement]:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

exports.approveJob = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await s.approveJob(id); // output: job object
    if (!result) return res.status(404).json({ message: "Job not found" });
    
    // Notify Client
    const io = req.app.get('io');
    await notificationService.createNotification({
        userId: result.client_id,
        type: 'JOB_APPROVED',
        title: 'Job Approved',
        message: `Your job "${result.title}" has been approved and is now Open.`,
        data: { jobId: result.id },
        io
    });
    
    return res.json({ message: "Job approved", data: result });
  } catch (error) {
    console.error("ADMIN_ERROR [getJobsManagement]:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

exports.rejectJob = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    if (!reason) return res.status(400).json({ message: "Rejection reason is required" });
    
    const result = await s.rejectJob(id, reason);
    if (!result) return res.status(404).json({ message: "Job not found" });
    
    // Notify Client
    const io = req.app.get('io');
    await notificationService.createNotification({
        userId: result.client_id,
        type: 'JOB_REJECTED',
        title: 'Job Rejected',
        message: `Your job "${result.title}" was rejected. Reason: ${reason}`,
        data: { jobId: result.id },
        io
    });
    
    return res.json({ message: "Job rejected", data: result });
  } catch (error) {
    console.error("ADMIN_ERROR [getJobsManagement]:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const stats = await s.getStats();
    return res.json({ data: stats });
  } catch (error) {
    console.error("ADMIN_ERROR [getJobsManagement]:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

exports.getFinancialOverview = async (req, res) => {
  try {
    const financials = await s.getFinancials();
    return res.json({ data: financials });
  } catch (error) {
    console.error("ADMIN_ERROR [getJobsManagement]:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

exports.listAllUsers = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const result = await s.listUsers({ 
      page: Number(page) || 1, 
      limit: Number(limit) || 10 
    });
    return res.json({ data: result });
  } catch (error) {
    console.error("ADMIN_ERROR [getJobsManagement]:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

exports.updateUserRoleHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;
    
    if (!['employer', 'worker', 'manager', 'admin'].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const user = await s.updateUserRole(id, role);
    if (!user) return res.status(404).json({ message: "User not found" });

    return res.json({ message: "User role updated successfully", data: user });
  } catch (error) {
    console.error("ADMIN_ERROR [getJobsManagement]:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};
exports.getTransactions = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const transactions = await s.listTransactions({ 
      page: Number(page) || 1, 
      limit: Number(limit) || 20 
    });
    return res.json({ data: transactions });
  } catch (error) {
    console.error("ADMIN_ERROR [getJobsManagement]:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

exports.getJobsManagement = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const result = await s.getJobsManagement({ 
      page: Number(page) || 1, 
      limit: Number(limit) || 20 
    });
    return res.json({ data: result });
  } catch (error) {
    console.error("ADMIN_ERROR [getJobsManagement]:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

exports.getJobStats = async (req, res) => {
  try {
    const { period } = req.query; // week, month, year
    const stats = await s.getJobStatsByPeriod(period || 'month');
    return res.json({ data: stats });
  } catch (error) {
    console.error("ADMIN_ERROR [getJobsManagement]:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

exports.listCategoryProposals = async (req, res) => {
  try {
    const proposals = await s.getCategoryProposals();
    return res.json({ data: proposals });
  } catch (error) {
    console.error("ADMIN_ERROR [getJobsManagement]:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

exports.approveCategoryProposal = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await s.approveCategoryProposal(id);
    if (!result) return res.status(404).json({ message: "Proposal not found" });
    return res.json({ message: "Category proposal approved", data: result });
  } catch (error) {
    console.error("ADMIN_ERROR [getJobsManagement]:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

exports.rejectCategoryProposal = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await s.rejectCategoryProposal(id);
    if (!result) return res.status(404).json({ message: "Proposal not found" });
    return res.json({ message: "Category proposal rejected", data: result });
  } catch (error) {
    console.error("ADMIN_ERROR [getJobsManagement]:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

exports.createManager = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email and password are required" });
    
    const manager = await s.createManager({ email, password });
    return res.status(201).json({ message: "Manager created successfully", data: manager });
  } catch (error) {
    console.error(error);
    if (error.code === '23505') return res.status(409).json({ message: "Email already exists" });
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.listAdminNotifications = async (req, res) => {
  try {
    const { page, limit } = req.query;
    const notifications = await s.getAdminNotifications({ 
      page: Number(page) || 1, 
      limit: Number(limit) || 20 
    });
    return res.json({ data: notifications });
  } catch (error) {
    console.error("ADMIN_ERROR [getJobsManagement]:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

exports.markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;
    await s.markNotificationRead(id);
    return res.json({ message: "Notification marked as read" });
  } catch (error) {
    console.error("ADMIN_ERROR [getJobsManagement]:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};
