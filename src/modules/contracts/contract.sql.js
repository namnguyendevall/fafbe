module.exports = {
  getById: `
    SELECT c.*, 
           j.title as job_title,
           j.description as job_description,
           j.resource_urls as job_resource_urls,
           j.start_date as job_start_date,
           j.end_date as job_end_date,
           client.full_name as client_name,
           worker.full_name as worker_name,
           (SELECT id FROM disputes WHERE contract_id = c.id AND status = 'OPEN' ORDER BY created_at DESC LIMIT 1) as dispute_id
    FROM contracts c
    JOIN jobs j ON j.id = c.job_id
    LEFT JOIN user_profiles client ON client.user_id = j.client_id
    LEFT JOIN user_profiles worker ON worker.user_id = c.worker_id
    WHERE c.id = $1
  `,

  updateContent: `
    UPDATE contracts
    SET contract_content = $2, updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `,

  signContractClient: `
    UPDATE contracts
    SET signature_client = $2, signed_at = CASE WHEN signature_worker IS NOT NULL THEN NOW() ELSE signed_at END
    WHERE id = $1
    RETURNING *
  `,

  signContractWorker: `
    UPDATE contracts
    SET signature_worker = $2, signed_at = CASE WHEN signature_client IS NOT NULL THEN NOW() ELSE signed_at END
    WHERE id = $1
    RETURNING *
  `,

  getActiveContractByWorker: `
    SELECT c.*, 
           j.title as job_title,
           j.description as job_description,
           j.resource_urls as job_resource_urls,
           j.start_date as job_start_date,
           client.full_name as client_name,
           worker.full_name as worker_name,
           (SELECT id FROM disputes WHERE contract_id = c.id AND status = 'OPEN' ORDER BY created_at DESC LIMIT 1) as dispute_id
    FROM contracts c
    JOIN jobs j ON j.id = c.job_id
    LEFT JOIN user_profiles client ON client.user_id = j.client_id
    LEFT JOIN user_profiles worker ON worker.user_id = c.worker_id
    WHERE c.worker_id = $1 
      AND c.status NOT IN ('COMPLETED', 'CANCELLED', 'TERMINATED')
    ORDER BY 
      CASE 
        WHEN c.status = 'ACTIVE' THEN 0 
        WHEN c.status = 'DRAFT' THEN 1
        ELSE 2 
      END,
      c.updated_at DESC
    LIMIT 1
  `,

  getContractByJobAndWorker: `
    SELECT c.*, 
           j.title as job_title,
           j.description as job_description,
           j.resource_urls,
           j.start_date as job_start_date,
           client.full_name as client_name,
           worker.full_name as worker_name,
           (SELECT id FROM disputes WHERE contract_id = c.id AND status = 'OPEN' ORDER BY created_at DESC LIMIT 1) as dispute_id
    FROM contracts c
    JOIN jobs j ON j.id = c.job_id
    LEFT JOIN user_profiles client ON client.user_id = c.client_id
    LEFT JOIN user_profiles worker ON worker.user_id = c.worker_id
    WHERE c.job_id = $1 AND c.worker_id = $2
    ORDER BY 
      CASE 
        WHEN c.status = 'ACTIVE' THEN 0 
        WHEN c.status = 'DRAFT' THEN 1
        ELSE 2 
      END,
      c.created_at DESC
    LIMIT 1
  `,

  getContractsByUser: `
    SELECT c.*, 
           j.title as job_title,
           j.description as job_description,
           j.resource_urls,
           j.start_date as job_start_date,
           j.end_date as job_end_date,
           client.full_name as client_name,
           worker.full_name as worker_name
    FROM contracts c
    JOIN jobs j ON j.id = c.job_id
    LEFT JOIN user_profiles client ON client.user_id = c.client_id
    LEFT JOIN user_profiles worker ON worker.user_id = c.worker_id
    WHERE c.client_id = $1 OR c.worker_id = $1
    ORDER BY c.created_at DESC
  `,

  getCheckpointsByContract: `
    SELECT cp.*, 
           (SELECT id FROM disputes WHERE checkpoint_id = cp.id LIMIT 1) as existing_dispute_id
    FROM checkpoints cp
    WHERE cp.contract_id = $1 
    ORDER BY cp.id ASC
  `,

  submitCheckpoint: `
    UPDATE checkpoints
    SET status = 'SUBMITTED',
        submission_url = $2,
        submission_notes = $3,
        submitted_at = NOW(),
        updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `,

  approveCheckpoint: `
    UPDATE checkpoints
    SET status = 'APPROVED',
        review_notes = $2,
        reviewed_at = NOW(),
        updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `,

  rejectCheckpoint: `
    UPDATE checkpoints
    SET status = 'REJECTED',
        rework_count = rework_count + 1,
        review_notes = $2,
        reviewed_at = NOW(),
        updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `,

  requestSettlement: `
    UPDATE contracts
    SET settlement_requested_at = NOW(), updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `,

  cancelCheckpointsByContract: `
    UPDATE checkpoints
    SET status = 'CANCELLED', updated_at = NOW()
    WHERE contract_id = $1 AND status != 'APPROVED'
  `,

  completeContract: `
    UPDATE contracts
    SET status = 'COMPLETED', updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `
};
