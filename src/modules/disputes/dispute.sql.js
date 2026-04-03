module.exports = {
  create: `
    INSERT INTO disputes (contract_id, checkpoint_id, raised_by, reason, employer_resolution_deadline, status, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, 'OPEN', NOW(), NOW())
    RETURNING *
  `,
  
  getById: `
    SELECT d.*, 
           u.email as raiser_email,
           j.title as job_title,
           j.description as job_description,
           j.resource_urls as job_resource_urls,
           c.contract_content as contract_content,
           c.total_amount as contract_total_amount,
           cp.title as checkpoint_title,
           cp.description as checkpoint_description,
           cp.deadline as checkpoint_deadline,
           cp.amount as checkpoint_amount,
           cp.rework_count as checkpoint_rework_count,
           cp.rework_limit as checkpoint_rework_limit,
           uc.email as client_email,
           uw.email as worker_email
    FROM disputes d
    JOIN users u ON u.id = d.raised_by
    JOIN contracts c ON c.id = d.contract_id
    JOIN jobs j ON j.id = c.job_id
    JOIN users uc ON uc.id = c.client_id
    JOIN users uw ON uw.id = c.worker_id
    LEFT JOIN checkpoints cp ON cp.id = d.checkpoint_id
    WHERE d.id = $1
  `,

  updateStatus: `
    UPDATE disputes
    SET status = $2, resolution = $3, resolution_summary = $4, updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `,

  addMessage: `
    INSERT INTO dispute_messages (dispute_id, sender_id, message, attachments, image_url, created_at)
    VALUES ($1, $2, $3, $4, $5, NOW())
    RETURNING *
  `,
  getMessages: `
     SELECT m.*, u.email as email, u.role as role
     FROM dispute_messages m
     JOIN users u ON u.id = m.sender_id
     WHERE m.dispute_id = $1
     ORDER BY m.created_at ASC
  `,

  listAll: `
    SELECT d.*, 
           u.email as raiser_email,
           j.title as job_title,
           cp.title as checkpoint_title,
           cp.amount as escrow_amount,
           uc.email as client_email,
           uw.email as worker_email
    FROM disputes d
    JOIN users u ON u.id = d.raised_by
    JOIN contracts c ON d.contract_id = c.id
    JOIN jobs j ON c.job_id = j.id
    LEFT JOIN checkpoints cp ON cp.id = d.checkpoint_id
    LEFT JOIN users uc ON c.client_id = uc.id
    LEFT JOIN users uw ON c.worker_id = uw.id
    ORDER BY d.created_at DESC
  `,

  listByUser: `
    SELECT d.*, 
           u.email as raiser_email,
           j.title as job_title,
           cp.title as checkpoint_title,
           cp.amount as escrow_amount,
           uc.email as client_email,
           uw.email as worker_email
    FROM disputes d
    JOIN users u ON u.id = d.raised_by
    JOIN contracts c ON d.contract_id = c.id
    JOIN jobs j ON c.job_id = j.id
    LEFT JOIN checkpoints cp ON cp.id = d.checkpoint_id
    LEFT JOIN users uc ON c.client_id = uc.id
    LEFT JOIN users uw ON c.worker_id = uw.id
    WHERE c.client_id = $1 OR c.worker_id = $1
    ORDER BY d.created_at DESC
  `
};
