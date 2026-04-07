// src/modules/jobs/job.service.js

const pool = require("../../config/database");

/**
 * Tạo job + contract (DRAFT, ESCROW) + checkpoints trong 1 transaction
 *
 * @param {Object} params
 * @param {number} params.clientId
 * @param {string} params.title
 * @param {string} [params.description]
 * @param {('SHORT_TERM'|'LONG_TERM')} params.jobType
 * @param {number} params.budget
 * @param {Array<{title: string, description?: string, amount: number}>} params.checkpoints
 * @param {string} params.contractContent
 */

async function createJobWithContractAndCheckpoints({
  clientId,
  categoryId,
  categoryName,
  title,
  description,
  jobType,
  budget,
  totalLockAmount,
  checkpoints,
  contractContent,
  skills,
  startDate,
  endDate,
  deadline,
  resourceUrls = [],
  isDraft = false,
}) {
  console.log("👉 skills nhận được:", skills);
  console.log("checkpont", checkpoints);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1️⃣ Lock budget
    if (!isDraft) {
      const walletService = require("../wallets/wallet.service");
      await walletService.lockBudget(client, {
         userId: clientId,
         amount: totalLockAmount || budget,
         referenceId: 0, // We will update this after job is created? Or use a placeholder.
         referenceType: 'JOB_CREATION'
      });
    }

    const initialStatus = isDraft ? 'DRAFT' : 'PENDING';


    // 1.5 Moderate job content
    const moderationService = require('../../services/moderation.service');
    const skillNames = Array.isArray(skills) ? skills.map(s => typeof s === 'object' ? s?.name : '').filter(Boolean).join(' ') : '';
    const moderationText = `${title}\n${description || ''}\n${categoryName || ''}\n${skillNames}`;
    const moderationResult = await moderationService.moderateContent(moderationText);
    const moderationStatus = moderationService.getModerationStatus(moderationResult.approved);

    let finalCategoryId = categoryId;
    if (!finalCategoryId && categoryName) {
        const slugStr = categoryName.toLowerCase().replace(/\s+/g, '-');
        const resCat = await client.query('INSERT INTO job_categories (name, slug, is_active, created_at) VALUES ($1, $2, false, NOW()) RETURNING id', [categoryName, slugStr]);
        finalCategoryId = resCat.rows[0].id;
    }

    // 2️⃣ Tạo job
    const { rows: jobRows } = await client.query(
      `
      INSERT INTO jobs (
        client_id, category_id, title, description, job_type, budget, status, moderation_status, moderation_result, deadline, resource_urls, start_date, end_date, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
      RETURNING *
      `,
      [clientId, finalCategoryId, title, description || null, jobType, budget, initialStatus, moderationStatus, JSON.stringify(moderationResult), deadline || null, JSON.stringify(resourceUrls), startDate || null, endDate || null],
    );

    const job = jobRows[0];

    // 2️⃣.5️⃣ GÁN SKILLS
    if (Array.isArray(skills)) {
      for (const sk of skills) {
        if (!sk) continue;
        
        let skillId = null;
        if (typeof sk === 'object' && sk !== null) {
            skillId = sk.id;
            if (!skillId && sk.name) {
                const slugStr = sk.name.toLowerCase().replace(/\s+/g, '-');
                const resSk = await client.query('INSERT INTO skills (name, slug, is_active, created_at) VALUES ($1, $2, false, NOW()) RETURNING id', [sk.name, slugStr]);
                skillId = resSk.rows[0].id;
            }
        } else if (typeof sk === 'number' || typeof sk === 'string') {
            skillId = Number(sk); // Fallback for old payloads
        }

        if (skillId && !isNaN(skillId)) {
          await client.query(
            `
            INSERT INTO job_skills (job_id, skill_id, created_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT DO NOTHING
            `,
            [job.id, skillId],
          );
        }
      }
    }

    // 3️⃣ Tạo contract
    // Tính toán duration_days nếu startDate và endDate tồn tại
    let durationDays = null;
    if (startDate && endDate) {
      durationDays = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24));
    }

    const { rows: contractRows } = await client.query(
      `
      INSERT INTO contracts (
        job_id, client_id, contract_type,
        total_amount, contract_content, job_details, duration_days, status, created_at
      )
      VALUES ($1, $2, 'ESCROW', $3, $4, $5, $6, 'DRAFT', NOW())
      RETURNING *
      `,
      [job.id, clientId, budget, contractContent, description, durationDays],
    );

    const contract = contractRows[0];

    // 4️⃣ Checkpoints
    const createdCheckpoints = [];
    let currentDueDate = startDate ? new Date(startDate) : new Date();

    for (const cp of checkpoints) {
      const days = parseInt(cp.duration_days) || 7;
      // Sequential Calculation: Next deadline = Previous deadline + current duration
      currentDueDate = new Date(currentDueDate.getTime() + days * 24 * 60 * 60 * 1000);

      const { rows } = await client.query(
        `
        INSERT INTO checkpoints (
          contract_id, title, description,
          amount, due_date, duration_days, rework_limit, status, resource_urls, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, 3, 'PENDING', $7, NOW())
        RETURNING *
        `,
        [
          contract.id, 
          cp.title, 
          cp.description || null, 
          cp.amount, 
          currentDueDate, 
          days, 
          JSON.stringify(cp.resourceUrls || [])
        ],
      );
      createdCheckpoints.push(rows[0]);
    }

    await client.query("COMMIT");
    return { job, contract, checkpoints: createdCheckpoints };
  } catch (e) {
    console.error("❌ Job Creation Failed:", e);
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function handleCheckpointOverdue(client, checkpointId) {
  try {
    const cpRes = await client.query(
      `SELECT cp.*, c.worker_id, c.client_id, j.id as job_id 
       FROM checkpoints cp 
       JOIN contracts c ON cp.contract_id = c.id 
       JOIN jobs j ON c.job_id = j.id 
       WHERE cp.id = $1`,
      [checkpointId]
    );
    const cp = cpRes.rows[0];
    if (!cp || !cp.worker_id) return;

    // 1. Terminate Contract (Money stays in Jobs.total_lock_amount!)
    await client.query("UPDATE contracts SET status = 'TERMINATED', updated_at = NOW() WHERE id = $1", [cp.contract_id]);
    await client.query("UPDATE checkpoints SET status = 'CANCELLED' WHERE contract_id = $1 AND status NOT IN ('APPROVED', 'SUBMITTED')", [cp.contract_id]);

    // 2. Set Job status to EXPIRED
    await client.query("UPDATE jobs SET status = 'EXPIRED', updated_at = NOW() WHERE id = $1", [cp.job_id]);

    // 3. Create Auto-Review (1-star for all skills + calculated rating)
    const reviewService = require("../reviews/review.service");
    const allCpsRes = await client.query('SELECT status FROM checkpoints WHERE contract_id = $1', [cp.contract_id]);
    const approvedCount = allCpsRes.rows.filter(r => r.status === 'APPROVED').length;
    const totalCount = allCpsRes.rows.length;

    // Calculate rating based on progress (percentage of approved checkpoints)
    const calculatedRating = Math.max(1, Math.floor((approvedCount / totalCount) * 5));

    // Get skills for the job to penalize them with 1 star
    const skillsRes = await client.query('SELECT skill_id FROM job_skills WHERE job_id = $1', [cp.job_id]);
    const skillRatings = skillsRes.rows.map(s => ({ skillId: s.skill_id, rating: 1 }));

    await reviewService.createReview({
      contractId: cp.contract_id,
      reviewerId: cp.client_id,
      rating: calculatedRating,
      comment: `[FAF AUTO-FAIL] Worker failed to meet checkpoint deadline: "${cp.title}". Contract terminated automatically.`,
      skillRatings: skillRatings
    });

  } catch (err) {
    console.error("Auto-Penalty Error:", err);
  }
}

async function listJobs({ page = 1, limit = 10, categoryId, clientId, status, workerId }) {
  // 🕒 Bulk Lazy Expiration (Job Posting Deadline)
  await pool.query(
    `UPDATE jobs 
     SET status = 'EXPIRED', updated_at = NOW()
     WHERE status = 'OPEN' AND end_date < NOW()`
  );

  // 🕒 Overdue Checkpoint Penalty Check (Work Execution Deadline)
  const overdueCps = await pool.query(
    `SELECT id FROM checkpoints 
     WHERE status = 'PENDING' AND due_date < NOW() AND contract_id IN (
       SELECT id FROM contracts WHERE status = 'ACTIVE'
     )`
  );
  for (const cp of overdueCps.rows) {
    const client = await pool.connect();
    try {
      await handleCheckpointOverdue(client, cp.id);
    } finally {
      client.release();
    }
  }

  const offset = (page - 1) * limit;

  const params = [];
  const conditions = [];
  let joinClause = "";

  if (categoryId) {
    params.push(categoryId);
    conditions.push(`j.category_id = $${params.length}`);
  }

  if (clientId) {
    params.push(clientId);
    conditions.push(`j.client_id = $${params.length}`);
  }

  if (workerId) {
    params.push(workerId);
    joinClause = "JOIN contracts ct ON ct.job_id = j.id";
    conditions.push(`ct.worker_id = $${params.length}`);
  }

  // Default to OPEN status if not specified, support ALL to skip filter
  if (status !== 'ALL') {
    const jobStatus = status || 'OPEN';
    params.push(jobStatus);
    conditions.push(`j.status = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : "";

  const { rows } = await pool.query(
    `
    SELECT j.*,
           c.name AS category_name,
           (SELECT COUNT(*)::int FROM proposals p WHERE p.job_id = j.id) AS proposal_count
    FROM jobs j
    JOIN job_categories c ON c.id = j.category_id
    ${joinClause}
    ${whereClause}
    ORDER BY j.created_at DESC
    LIMIT $${params.length + 1}
    OFFSET $${params.length + 2}
    `,
    [...params, limit, offset],
  );

  return rows;
}


/**
 * GET JOB DETAIL
 */
async function getJobById(jobId, requestingUser = null) {
  // 🕒 Lazy Expiration Check
  await pool.query(
    `UPDATE jobs 
     SET status = 'EXPIRED', updated_at = NOW()
     WHERE id = $1 AND status = 'OPEN' AND end_date < NOW()`,
    [jobId]
  );

  // 🕒 Overdue Checkpoint Penalty Check (Specific Job)
  const overdueCps = await pool.query(
    `SELECT id FROM checkpoints 
     WHERE status = 'PENDING' AND due_date < NOW() AND contract_id IN (
       SELECT id FROM contracts WHERE job_id = $1 AND status = 'ACTIVE'
     )`,
    [jobId]
  );
  for (const cp of overdueCps.rows) {
    const client = await pool.connect();
    try {
      await handleCheckpointOverdue(client, cp.id);
    } finally {
      client.release();
    }
  }

  const { rows } = await pool.query(
    `
    SELECT j.*,
           c.name AS category_name,
           json_build_object(
             'id', u.id,
             'email', u.email,
             'full_name', up.full_name,
             'role', u.role,
             'created_at', u.created_at
           ) AS client,
            (SELECT json_build_object(
              'id', ct.id,
              'total_amount', ct.total_amount,
              'status', ct.status,
              'terms', ct.contract_content,
              'created_at', ct.created_at,
              'is_reviewed', EXISTS (SELECT 1 FROM reviews r WHERE r.contract_id = ct.id AND r.reviewer_id = $2)
            ) FROM contracts ct 
            WHERE ct.job_id = j.id 
            ORDER BY 
              CASE 
                WHEN ct.status = 'ACTIVE' THEN 1
                WHEN ct.status = 'DISPUTED' THEN 2
                WHEN (ct.status = 'COMPLETED' OR ct.status = 'TERMINATED') 
                     AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.contract_id = ct.id AND r.reviewer_id = $2) THEN 3
                WHEN ct.status = 'DRAFT' AND ct.worker_id IS NOT NULL THEN 4
                WHEN ct.status = 'DRAFT' THEN 5
                WHEN ct.status = 'COMPLETED' OR ct.status = 'TERMINATED' THEN 6
                ELSE 7
              END ASC,
              ct.created_at DESC LIMIT 1) AS contract,
           (SELECT COALESCE(json_agg(
              json_build_object(
                'id', cp.id,
                'name', cp.title,
                'description', cp.description,
                'amount', cp.amount,
                'status', cp.status,
                'deadline', cp.due_date,
                'duration_days', cp.duration_days,
                'submission_url', cp.submission_url,
                'submission_notes', cp.submission_notes
              ) ORDER BY cp.created_at ASC
            ), '[]') FROM checkpoints cp 
            WHERE cp.contract_id = (
              SELECT id FROM contracts 
              WHERE job_id = j.id 
              ORDER BY 
                CASE 
                  WHEN status = 'ACTIVE' THEN 1
                  WHEN status = 'DISPUTED' THEN 2
                  WHEN (status = 'COMPLETED' OR status = 'TERMINATED') 
                       AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.contract_id = id AND r.reviewer_id = $2) THEN 3
                  WHEN status = 'DRAFT' AND worker_id IS NOT NULL THEN 4
                  WHEN status = 'DRAFT' THEN 5
                  WHEN status = 'COMPLETED' OR status = 'TERMINATED' THEN 6
                  ELSE 7
                END ASC,
                created_at DESC LIMIT 1
            )) AS checkpoints,
           (SELECT d.id FROM disputes d JOIN contracts ct_dis ON d.contract_id = ct_dis.id WHERE ct_dis.job_id = j.id AND d.status = 'OPEN' LIMIT 1) AS dispute_id,
           COALESCE(
             json_agg(
               json_build_object(
                 'id', s.id,
                 'name', s.name,
                 'slug', s.slug
               )
             ) FILTER (WHERE s.id IS NOT NULL),
             '[]'
           ) AS skills
    FROM jobs j
    JOIN job_categories c ON c.id = j.category_id
    JOIN users u ON u.id = j.client_id
    LEFT JOIN user_profiles up ON up.user_id = u.id
    LEFT JOIN job_skills js ON js.job_id = j.id
    LEFT JOIN skills s ON s.id = js.skill_id
    WHERE j.id = $1
    GROUP BY j.id, c.name, u.id, u.email, u.role, u.created_at, up.full_name
    `,
    [jobId, requestingUser?.id || null],
  );

  const job = rows[0];
  if (!job) return null;

  // PRIVACY FILTER: Managers/Admins can ONLY see submission_url if there is an active dispute
  if (requestingUser && ['manager', 'admin'].includes(requestingUser.role?.toLowerCase())) {
    const { rows: disputeRes } = await pool.query(
        "SELECT 1 FROM disputes d JOIN contracts c ON d.contract_id = c.id WHERE c.job_id = $1 AND d.status = 'OPEN'",
        [jobId]
    );
    const hasActiveDispute = disputeRes.length > 0;

    if (!hasActiveDispute) {
        job.checkpoints = job.checkpoints.map(cp => ({
            ...cp,
            submission_url: null,
            submission_notes: "[HIDDEN_PRIVACY_PROTOCOL_ACTIVE]"
        }));
    }
  }

  return job;
}


/**
 * UPDATE JOB
 */
async function updateJob(jobId, data) {
  const { title, description, categoryId, skills = [], resourceUrls } = data;

  const sets = [
    'title = $1',
    'description = $2',
    'category_id = $3',
    'updated_at = NOW()'
  ];
  const params = [title, description, categoryId];

  if (resourceUrls) {
    params.push(JSON.stringify(resourceUrls));
    sets.push(`resource_urls = $${params.length}`);
  }

  params.push(jobId);
  const whereClause = `WHERE id = $${params.length}`;

  const { rows } = await pool.query(
    `
    UPDATE jobs
    SET ${sets.join(', ')}
    ${whereClause}
    RETURNING *
    `,
    params
  );

  // reset skills
  await pool.query(`DELETE FROM job_skills WHERE job_id = $1`, [jobId]);

  for (const skillId of skills) {
    if (!skillId) continue;
    await pool.query(
      `
      INSERT INTO job_skills (job_id, skill_id, created_at)
      VALUES ($1, $2, NOW())
      `,
      [jobId, skillId],
    );
  }

  return rows[0];
}

/**
 * DELETE JOB (soft delete & refund)
 */
async function deleteJob(jobId, requestingUser) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch Job
    const jobRes = await client.query('SELECT * FROM jobs WHERE id = $1', [jobId]);
    const job = jobRes.rows[0];
    if (!job) throw new Error("JOB_NOT_FOUND");

    // 2. Role Verification
    if (requestingUser.role !== 'admin' && job.client_id !== requestingUser.id) {
        throw new Error("UNAUTHORIZED");
    }

    // 3. Status Gate (must be PENDING or OPEN or REJECTED or EXPIRED)
    if (!['PENDING', 'OPEN', 'REJECTED', 'EXPIRED'].includes(job.status)) {
        throw new Error("CANNOT_DELETE_ACTIVE_JOB");
    }

    // 4. Update parent Job Status -> CANCELLED
    const { rowCount } = await client.query(
      `
      UPDATE jobs
      SET status = 'CANCELLED',
          updated_at = NOW()
      WHERE id = $1
      `,
      [jobId],
    );

    // 5. Update related DRAFT contracts -> CANCELLED
    await client.query(
      `
      UPDATE contracts
      SET status = 'CANCELLED', updated_at = NOW()
      WHERE job_id = $1 AND status = 'DRAFT'
      `,
      [jobId]
    );

    // 6. Refund employer from Job Escrow (Remaining total_lock_amount)
    if (job.status !== 'REJECTED' && Number(job.total_lock_amount || 0) > 0) {
        const refundAmount = Number(job.total_lock_amount);
        
        const walletService = require("../wallets/wallet.service");
        await walletService.refundLockedFunds(client, {
            userId: job.client_id,
            amount: refundAmount,
            referenceId: jobId,
            referenceType: 'JOB_CANCELED'
        });

        // Zero out the lock amount after refund
        await client.query("UPDATE jobs SET total_lock_amount = 0 WHERE id = $1", [jobId]);
    }

    await client.query('COMMIT');
    return rowCount > 0;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * LIST PENDING JOBS (for Manager/Admin)
 */
async function listPendingJobs({ page = 1, limit = 10 }) {
  const offset = (page - 1) * limit;
  const { rows } = await pool.query(
    `
    SELECT j.*, c.name AS category_name, u.email as client_email
    FROM jobs j
    JOIN job_categories c ON c.id = j.category_id
    JOIN users u ON u.id = j.client_id
    WHERE j.status = 'PENDING'
    ORDER BY j.created_at ASC
    LIMIT $1 OFFSET $2
    `,
    [limit, offset]
  );
  return rows;
}

/**
 * REVIEW JOB (Approve/Reject)
 */
async function reviewJob(jobId, { status, adminComment, adminId }) {
  if (!['OPEN', 'REJECTED'].includes(status)) {
    throw new Error("INVALID_STATUS");
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch job
    const jobRes = await client.query('SELECT * FROM jobs WHERE id = $1', [jobId]);
    const job = jobRes.rows[0];
    if (!job) throw new Error("JOB_NOT_FOUND");
    if (job.status !== 'PENDING') throw new Error("JOB_NOT_PENDING");

    // 2. Update job status
    const { rows } = await client.query(
      `
      UPDATE jobs
      SET status = $1,
          admin_comment = $2,
          updated_at = NOW()
      WHERE id = $3
      RETURNING *
      `,
      [status, adminComment || null, jobId]
    );
    const updatedJob = rows[0];

    // 3. If OPEN, notify matching workers (Innovation Feature)
    if (status === 'OPEN') {
      try {
        const matchingService = require('../matching/matching.service');
        const notificationService = require('../notifications/notification.service');
        // io is usually passed via app.get('io') in controller, but we might need a better way if service is decoupled.
        // For now, we'll try to find it or just log. In FAF, we often pass it or use a global.
        // Since reviewJob is called from controller, we can pass io or hope it handles it.
        // I'll assume it's available or failing gracefully.
        
        const workers = await matchingService.getRecommendedWorkers(jobId, 10);
        const io = global.io; // Assuming global.io is set during startup (common pattern)
        
        for (const worker of workers) {
            await notificationService.createNotification({
                userId: worker.id,
                type: 'SKILL_MATCH_ALERT',
                title: 'New Job Matching Your Skills!',
                message: `The job "${updatedJob.title}" matches your top skills. Apply now!`,
                data: { jobId: job.id },
                io
            });
        }
      } catch (e) {
        console.error("Match Notification Failed:", e);
      }
    }

    // 3.5 If REJECTED, refund funds to client
    if (status === 'REJECTED') {

      const budget = Number(job.budget);
      const walletService = require("../wallets/wallet.service");
      await walletService.refundLockedFunds(client, {
         userId: job.client_id,
         amount: budget,
         referenceId: jobId,
         referenceType: 'JOB_REJECTION'
      });
    }


    await client.query('COMMIT');
    return job;
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.message === "INSUFFICIENT_BALANCE") {
        throw new Error("WALLET_INSUFFICIENT_BALANCE");
    }
    throw error;
  } finally {
    client.release();
  }
}

async function renewJob(jobId, { endDate, clientId }) {
  const { rows } = await pool.query(
    `UPDATE jobs 
     SET status = 'OPEN', end_date = $1, updated_at = NOW()
     WHERE id = $2 AND client_id = $3 AND (status = 'EXPIRED' OR status = 'OPEN')
     RETURNING *`,
    [endDate, jobId, clientId]
  );
  return rows[0];
}

module.exports = {
  createJobWithContractAndCheckpoints,
  listJobs,
  getJobById,
  updateJob,
  deleteJob,
  listPendingJobs,
  reviewJob,
  renewJob,
};

