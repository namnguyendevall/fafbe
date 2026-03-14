module.exports = {
  getPendingJobs: `
    SELECT j.*, c.name as category_name, u.email as client_email
    FROM jobs j
    JOIN job_categories c ON j.category_id = c.id
    JOIN users u ON j.client_id = u.id
    WHERE j.status = 'PENDING'
    ORDER BY j.created_at DESC
  `,

  getAllJobs: `
    SELECT j.*, c.name as category_name, u.email as client_email
    FROM jobs j
    LEFT JOIN job_categories c ON j.category_id = c.id
    LEFT JOIN users u ON j.client_id = u.id
    ORDER BY j.created_at DESC
  `,
  
  approveJob: `
    UPDATE jobs
    SET status = 'OPEN', admin_comment = NULL, updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `,
  
  rejectJob: `
    UPDATE jobs
    SET status = 'REJECTED', admin_comment = $2, updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `,

  getStats: `
    SELECT 
      (SELECT COUNT(*)::int FROM users) as total_users,
      (SELECT COUNT(*)::int FROM users WHERE role = 'employer') as total_employers,
      (SELECT COUNT(*)::int FROM users WHERE role = 'worker') as total_workers,
      (SELECT COUNT(*)::int FROM users WHERE role = 'manager') as total_managers,
      (SELECT COUNT(*)::int FROM jobs) as total_jobs,
      (SELECT COUNT(*)::int FROM jobs WHERE status = 'OPEN') as open_jobs,
      (SELECT COUNT(*)::int FROM jobs WHERE status = 'COMPLETED') as completed_jobs,
      (SELECT COUNT(*)::int FROM jobs WHERE status = 'PENDING') as pending_jobs
  `,

  getFinancials: `
    SELECT 
      (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE type = 'RELEASE') as total_turnover,
      (
        SELECT COALESCE(SUM(j.budget * 0.05), 0)
        FROM jobs j 
        JOIN contracts c ON j.id = c.job_id 
        JOIN checkpoints cp ON c.id = cp.contract_id 
        WHERE cp.status = 'APPROVED'
      ) as total_fees,
      (SELECT COALESCE(SUM(balance_points), 0) FROM wallets) as tokens_circulating,
      (SELECT COALESCE(SUM(locked_points), 0) FROM wallets) as locked_in_escrow,
      (SELECT COUNT(*)::int FROM (SELECT 1 FROM information_schema.tables WHERE table_name = 'disputes') as check_table CROSS JOIN disputes WHERE status = 'OPEN') as active_disputes
  `,


  listUsersFull: `
    SELECT u.id, u.email, u.role, u.status, u.created_at, p.full_name as name, p.avatar_url as avatar, w.balance_points
    FROM users u
    LEFT JOIN user_profiles p ON u.id = p.user_id
    LEFT JOIN wallets w ON u.id = w.user_id
    ORDER BY u.created_at DESC
    LIMIT $1 OFFSET $2
  `,


  countUsers: `SELECT COUNT(*) FROM users`,

  updateUserRole: `
    UPDATE users
    SET role = $2
    WHERE id = $1
    RETURNING id, email, role
  `,

  listTransactions: `
    SELECT t.*, u.email, p.full_name
    FROM transactions t
    JOIN wallets w ON t.wallet_id = w.user_id
    JOIN users u ON w.user_id = u.id
    LEFT JOIN user_profiles p ON u.id = p.user_id
    ORDER BY t.created_at DESC
    LIMIT $1 OFFSET $2
  `,

  getJobsManagement: `
    SELECT 
      j.id, 
      j.title, 
      j.status, 
      j.budget, 
      j.created_at,
      u_client.email as client_email,
      u_worker.email as worker_email,
      (SELECT COUNT(*)::int FROM checkpoints cp WHERE cp.contract_id = c.id) as total_checkpoints,
      (SELECT COUNT(*)::int FROM checkpoints cp WHERE cp.contract_id = c.id AND cp.status = 'APPROVED') as approved_checkpoints,
      EXISTS(SELECT 1 FROM disputes d WHERE d.contract_id = c.id AND d.status = 'OPEN') as has_dispute,
      (SELECT d.id FROM disputes d WHERE d.contract_id = c.id AND d.status = 'OPEN' LIMIT 1) as dispute_id
    FROM jobs j
    JOIN users u_client ON j.client_id = u_client.id
    LEFT JOIN contracts c ON j.id = c.job_id
    LEFT JOIN users u_worker ON c.worker_id = u_worker.id
    ORDER BY j.created_at DESC
    LIMIT $1 OFFSET $2
  `,

  getJobStatsByPeriod: `
    SELECT 
      DATE_TRUNC($1, created_at) as period,
      COUNT(*) as count,
      SUM(budget) as total_budget
    FROM jobs
    WHERE created_at >= NOW() - INTERVAL '1 year'
    GROUP BY period
    ORDER BY period DESC
  `,

  getCategoryProposals: `
    SELECT cp.*, u.email as user_email
    FROM category_proposals cp
    JOIN users u ON cp.user_id = u.id
    WHERE cp.status = 'PENDING'
    ORDER BY cp.created_at DESC
  `,

  approveCategoryProposal: `
    UPDATE category_proposals
    SET status = 'APPROVED', updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `,

  rejectCategoryProposal: `
    UPDATE category_proposals
    SET status = 'REJECTED', updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `,

  getAdminNotifications: `
    SELECT n.*, u.email as sender_email
    FROM admin_notifications n
    JOIN users u ON n.sender_id = u.id
    ORDER BY n.created_at DESC
    LIMIT $1 OFFSET $2
  `,

  createAdminNotification: `
    INSERT INTO admin_notifications (sender_id, title, message, type, data)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `,

  markNotificationRead: `
    UPDATE admin_notifications
    SET is_read = true
    WHERE id = $1
  `
};


