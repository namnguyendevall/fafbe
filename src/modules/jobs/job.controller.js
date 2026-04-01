const { createJobWithContractAndCheckpoints, getJobById,
  listJobs,
  updateJob,
  reviewJob,
  deleteJob, } = require("./job.service");
const { getCategoryById } = require("../category/cate.service");

const PLATFORM_FEE_PERCENT = 5; // 5%

const ALLOWED_JOB_TYPES = ["SHORT_TERM", "LONG_TERM"];

function validateCreateJobPayload(body) {
  const errors = [];

  const { title, description, jobType, budget, checkpoints, categoryId } = body;

  console.log(checkpoints)

  if (!title) {
    errors.push("title is required");
  }

  if (!categoryId || !Number.isInteger(Number(categoryId))) {
    errors.push("categoryId is required and must be a number");
  }

  if (!jobType) {
    errors.push("jobType is required");
  } else if (!ALLOWED_JOB_TYPES.includes(jobType)) {
    errors.push(`jobType must be one of: ${ALLOWED_JOB_TYPES.join(", ")}`);
  }

  const budgetNum = Number(budget);
  if (!Number.isFinite(budgetNum) || budgetNum <= 0) {
    errors.push("budget must be a positive number");
  }

  if (!Array.isArray(checkpoints) || checkpoints.length === 0) {
    errors.push("at least one checkpoint is required");
  } else {
    let sum = 0;

    checkpoints.forEach((cp, index) => {
      if (!cp.title) {
        errors.push(`checkpoints[${index}].title is required`);
      }

      const amountNum = Number(cp.amount);
      if (!Number.isFinite(amountNum) || amountNum <= 0) {
        errors.push(`checkpoints[${index}].amount must be a positive number`);
      }

      sum += amountNum;
    });

    if (Math.abs(sum - budgetNum) > 0.01) {
      errors.push(`sum of checkpoints amount (${sum}) must exist budget (${budgetNum})`);
    }
  }

  // Validate Dates
  if (body.startDate) {
    const start = new Date(body.startDate);
    if (isNaN(start.getTime())) {
      errors.push("startDate is invalid");
    }
  }

  if (body.endDate) {
    const end = new Date(body.endDate);
    if (isNaN(end.getTime())) {
      errors.push("endDate is invalid");
    }

    if (body.startDate) {
        const start = new Date(body.startDate);
        if (end <= start) {
            errors.push("endDate must be after startDate");
        }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

const BASE_CONTRACT_TEMPLATE = {
  title: "FAF Standard Service Contract",
  defaultClauses: [
    "Thanh toán theo từng checkpoint đã được client duyệt.",
    "Client phải nạp đủ total_amount vào escrow trước khi bắt đầu làm.",
    "Tranh chấp sẽ được giải quyết theo quy trình dispute của FAF.",
  ],
};

/**
 * POST /api/jobs
 * Chỉ CLIENT (task owner) được tạo job
 * Body expected (theo UI):
 * {
 *   title: string,
 *   description?: string,
 *   jobType: 'SHORT_TERM' | 'LONG_TERM',
 *   budget: number,
 *   checkpoints: [
 *     { title: string, description?: string, amount: number },
 *     ...
 *   ]
 * }
 */
async function createJob(req, res) {
  try {
    const user = req.user;
    console.log(`>>> [createJob] User ID: ${user?.id}, Role: ${user?.role}, Email: ${user?.email}`);

    if (!user) {
      console.error(`[createJob] FAILED: No user found in request (Unauthorized)`);
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (user.role !== "employer" && user.role !== "admin") {
      console.error(`[createJob] FAILED: User role "${user.role}" is NOT authorized. Expected "employer" or "admin".`);
      return res.status(403).json({
        message: "Only clients (task owners) or admins can create jobs",
      });
    }

    console.log(`[createJob] Role check PASSED for user: ${user.id}`);

    const {
      title,
      description,
      jobType,
      budget,
      checkpoints,
      contractContent,
      categoryId,
      skills,
      startDate,
      endDate,
      resourceUrls,
    } = req.body;

    // ✅ 2. Validate payload
    const { isValid, errors } = validateCreateJobPayload(req.body);
    if (!isValid) {
      return res.status(400).json({
        message: "Invalid request body",
        errors,
      });
    }

    // ✅ 3. Validate category tồn tại & active
    const category = await getCategoryById(Number(categoryId));
    if (!category || !category.is_active) {
      return res.status(400).json({
        message: "Invalid or inactive category",
      });
    }

    const budgetNum = Number(budget);

    const platformFeeAmount = Math.round(
      (budgetNum * PLATFORM_FEE_PERCENT) / 100,
    );
    const totalLockAmount = budgetNum + platformFeeAmount;

    // ✅ 4. Create job + contract + checkpoints
    const {
      job,
      contract,
      checkpoints: createdCheckpoints,
    } = await createJobWithContractAndCheckpoints({
      clientId: user.id,
      title,
      description,
      jobType,
      budget: budgetNum,
      totalLockAmount,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      checkpoints: checkpoints.map((cp) => ({
        title: cp.title,
        description: cp.description,
        amount: Number(cp.amount),
        duration_days: Number(cp.duration_days) || 7,
      })),
      contractContent,
      categoryId: Number(categoryId),
      skills,
      deadline: req.body.deadline,
      resourceUrls: resourceUrls || [],
    });

    // Notify Admins
    try {
        const adminService = require('../admin/admin.service');
        const adminIds = await adminService.getAdminIds();
        
        const notificationService = require('../notifications/notification.service');
        const io = req.app.get('io');

        for (const adminId of adminIds) {
            await notificationService.createNotification({
                userId: adminId,
                type: 'JOB_APPROVAL_REQUEST',
                title: `New job "${job.title}" requires approval.`,
                data: { jobId: job.id },
                io
            });
        }
    } catch (notifyErr) {
        console.error("Failed to notify admins:", notifyErr);
    }

    return res.status(201).json({
      message: "Job created successfully",
      data: {
        job,
        contract,
        checkpoints: createdCheckpoints,
        summary: {
          totalJobBudget: budgetNum,
          platformFeePercent: PLATFORM_FEE_PERCENT,
          platformFeeAmount,
          totalEscrow: budgetNum,
          clientPays: budgetNum + platformFeeAmount,
          workerEarns: budgetNum,
        },
      },
    });
  } catch (error) {
    if (error.message === "WALLET_INSUFFICIENT_BALANCE" || error.message === "INSUFFICIENT_BALANCE") {
      return res.status(400).json({
        message: "Insufficient wallet balance to post this job",
        error: "INSUFFICIENT_BALANCE"
      });
    }

    console.error(error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
}


/* =========================
   GET /api/jobs/:id
========================= */
async function getJob(req, res) {
  try {
    const job = await getJobById(Number(req.params.id), req.user);

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    return res.json({ data: job });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

/* =========================
   GET /api/jobs
========================= */
async function getListJobs(req, res) {
  try {
    // Public job board only shows OPEN jobs
    const jobs = await listJobs({
      status: 'OPEN',
      categoryId: req.query.categoryId,
      clientId: req.query.clientId,
    });

    return res.json({ data: jobs });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
}


async function getMyJobs(req, res) {
  try {
    const user = req.user;
    const { status, categoryId, page, limit } = req.query;

    const filter = {
      status: status || 'ALL', // History usually shows everything
      categoryId,
      page: Number(page) || 1,
      limit: Number(limit) || 10
    };

    if (user.role === 'employer') {
      filter.clientId = user.id;
    } else if (user.role === 'worker') {
      filter.workerId = user.id;
    } else {
      return res.status(403).json({ message: "Invalid role for job history" });
    }

    const jobs = await listJobs(filter);
    return res.json({ data: jobs });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
}



/* =========================
   PUT /api/jobs/:id
========================= */
async function updateJobHandler(req, res) {
  try {
    const jobId = Number(req.params.id);

    const job = await updateJob(jobId, req.body);

    return res.json({
      message: 'Job updated successfully',
      data: job,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

/* =========================
   DELETE /api/jobs/:id
========================= */
async function getAdminPendingJobs(req, res) {
  try {
    if (req.user.role !== 'manager' && req.user.role !== 'admin') {
      return res.status(403).json({ message: "Unauthorized. Manager/Admin only." });
    }

    const { page, limit } = req.query;
    const jobs = await listPendingJobs({ 
      page: Number(page) || 1, 
      limit: Number(limit) || 10 
    });

    return res.json({ data: jobs });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

async function reviewJobHandler(req, res) {
  try {
    if (req.user.role !== 'manager' && req.user.role !== 'admin') {
      return res.status(403).json({ message: "Unauthorized. Manager/Admin only." });
    }

    const jobId = Number(req.params.id);
    const { status, adminComment } = req.body;

    const job = await reviewJob(jobId, { 
      status, 
      adminComment, 
      adminId: req.user.id 
    });

    // Notify Client
    try {
        const notificationService = require('../notifications/notification.service');
        const io = req.app.get('io');
        await notificationService.createNotification({
            userId: job.client_id,
            type: status === 'OPEN' ? 'JOB_APPROVED' : 'JOB_REJECTED',
            title: status === 'OPEN' ? 'Job Approved' : 'Job Rejected',
            message: status === 'OPEN' 
                ? `Your job "${job.title}" has been approved and is now public.` 
                : `Your job "${job.title}" was rejected: ${adminComment || 'No comment provided.'}`,
            data: { jobId: job.id },
            io
        });
    } catch (notifyErr) {
        console.error("Failed to notify client about job review:", notifyErr);
    }

    return res.json({
      message: `Job ${status.toLowerCase()} successfully`,
      data: job
    });

  } catch (error) {
    console.error(error);
    if (error.message === 'JOB_NOT_FOUND') return res.status(404).json({ message: "Job not found" });
    if (error.message === 'JOB_NOT_PENDING') return res.status(400).json({ message: "Job is not in pending status" });
    if (error.message === 'INVALID_STATUS') return res.status(400).json({ message: "Invalid status. Must be OPEN or REJECTED" });
    return res.status(500).json({ message: "Internal server error", error: error.message, stack: error.stack });
  }
}

async function deleteJobHandler(req, res) {
  try {
    const success = await deleteJob(Number(req.params.id), req.user);

    if (!success) {
      return res.status(404).json({ message: 'Job not found or could not be cancelled' });
    }

    return res.json({ message: 'Job strictly cancelled and logic processed successfully' });
  } catch (error) {
    console.error(error);
    if (error.message === 'CANNOT_DELETE_ACTIVE_JOB') {
        return res.status(400).json({ message: "Cannot cancel a job that is already active or in progress. Please use the Dispute system instead." });
    }
    if (error.message === 'UNAUTHORIZED') {
        return res.status(403).json({ message: "You are not authorized to cancel this job." });
    }
    return res.status(500).json({ message: "Internal server error" });
  }
}

module.exports = {
  createJob,
  getJob,
  getListJobs,
  getMyJobs,
  updateJobHandler,
  deleteJobHandler,
  getAdminPendingJobs,
  reviewJobHandler,
};


