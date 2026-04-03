const pool = require("../../config/database");
const sql = require("./admin.sql");

exports.getPendingJobs = async () => {
  const { rows } = await pool.query(sql.getPendingJobs);
  return rows;
};

exports.getAllJobs = async () => {
  const { rows } = await pool.query(sql.getAllJobs);
  return rows;
};

exports.approveJob = async (jobId) => {
  const { rows } = await pool.query(sql.approveJob, [jobId]);
  return rows[0];
};

exports.rejectJob = async (jobId, reason) => {
  const { rows } = await pool.query(sql.rejectJob, [jobId, reason]);
  return rows[0];
};

exports.getAdminIds = async () => {
    const { rows } = await pool.query("SELECT id FROM users WHERE role = 'admin'");
    return rows.map(r => r.id);
};

exports.getStats = async () => {
  const { rows } = await pool.query(sql.getStats);
  return rows[0];
};

exports.getFinancials = async () => {
  const { rows } = await pool.query(sql.getFinancials);
  return rows[0];
};

exports.listUsers = async ({ page = 1, limit = 10 }) => {
  const offset = (page - 1) * limit;
  const { rows: users } = await pool.query(sql.listUsersFull, [limit, offset]);
  const { rows: countRes } = await pool.query(sql.countUsers);
  
  return {
    users,
    total: parseInt(countRes[0].count),
    page,
    limit
  };
};

exports.updateUserRole = async (userId, role) => {
  const { rows } = await pool.query(sql.updateUserRole, [userId, role]);
  return rows[0];
};

exports.listTransactions = async ({ page = 1, limit = 10 }) => {
  const offset = (page - 1) * limit;
  const { rows } = await pool.query(sql.listTransactions, [limit, offset]);
  return rows;
};

exports.getJobsManagement = async ({ page = 1, limit = 20 }) => {
  const offset = (page - 1) * limit;
  const { rows } = await pool.query(sql.getJobsManagement, [limit, offset]);
  return rows;
};

exports.getJobStatsByPeriod = async (period = 'month') => {
  const { rows } = await pool.query(sql.getJobStatsByPeriod, [period]);
  return rows;
};

exports.getCategoryProposals = async () => {
  const { rows } = await pool.query(sql.getCategoryProposals);
  return rows;
};

exports.approveCategoryProposal = async (proposalId) => {
  const { rows } = await pool.query(sql.approveCategoryProposal, [proposalId]);
  return rows[0];
};

exports.rejectCategoryProposal = async (proposalId) => {
  const { rows } = await pool.query(sql.rejectCategoryProposal, [proposalId]);
  return rows[0];
};

exports.getAdminNotifications = async ({ page = 1, limit = 20 }) => {
  const offset = (page - 1) * limit;
  const { rows } = await pool.query(sql.getAdminNotifications, [limit, offset]);
  return rows;
};

exports.createAdminNotification = async ({ senderId, title, message, type, data }) => {
  const { rows } = await pool.query(sql.createAdminNotification, [senderId, title, message, type, data]);
  return rows[0];
};

const bcrypt = require('bcrypt');

exports.createManager = async ({ email, password }) => {
  const hashedPassword = await bcrypt.hash(password, 10);
  const { rows } = await pool.query(
    "INSERT INTO users (email, password_hash, role, status, is_email_verified) VALUES ($1, $2, 'manager', 'ACTIVE', true) RETURNING id, email, role, status",
    [email, hashedPassword]
  );
  return rows[0];
};

exports.markNotificationRead = async (id) => {
    await pool.query(sql.markNotificationRead, [id]);
};

exports.getInactiveCategories = async () => {
    const { rows } = await pool.query("SELECT * FROM job_categories WHERE is_active = false");
    return rows;
};

exports.approveInactiveCategory = async (id) => {
    await pool.query("UPDATE job_categories SET is_active = true WHERE id = $1", [id]);
};

exports.rejectInactiveCategory = async (id) => {
    await pool.query("UPDATE job_categories SET is_active = null WHERE id = $1", [id]);
};

exports.getInactiveSkills = async () => {
    const { rows } = await pool.query("SELECT * FROM skills WHERE is_active = false");
    return rows;
};

exports.approveInactiveSkill = async (id) => {
    await pool.query("UPDATE skills SET is_active = true WHERE id = $1", [id]);
};

exports.rejectInactiveSkill = async (id) => {
    await pool.query("UPDATE skills SET is_active = null WHERE id = $1", [id]);
};

