const s = require("./proposal.service");
const { getJobById } = require("../jobs/job.service");
const notificationService = require('../notifications/notification.service');
const chatService = require('../chat/chat.service');

exports.create = async (req, res) => {
  try {
    const { jobId, coverLetter, proposedPrice } = req.body;
    const workerId = req.user.id;
    
    if (!jobId || !proposedPrice) {
        return res.status(400).json({ message: "jobId and proposedPrice are required" });
    }

    const proposal = await s.createProposal({
        jobId, workerId, coverLetter, proposedPrice
    });

    // Notify Client (Optional, don't let it crash the whole request)
    try {
        const job = await getJobById(jobId);
        if (job) {
            const io = req.app.get('io');
            await notificationService.createNotification({
                userId: job.client_id,
                type: 'PROPOSAL_RECEIVED',
                title: 'New Proposal Received',
                message: `You have a new proposal for job "${job.title}"`,
                data: { proposalId: proposal.id, jobId: job.id },
                io
            });
        }
    } catch (notifErr) {
        console.error("[Proposal Controller] Notification failed:", notifErr.message);
        // We still return 201 because the proposal itself was created
    }

    return res.status(201).json({ 
        message: "Proposal sent successfully",
        data: proposal 
    });

  } catch (error) {
    if (error.message === 'JOB_NOT_FOUND') return res.status(404).json({ message: "Job not found" });
    if (error.message === 'JOB_NOT_OPEN') return res.status(400).json({ message: "Job is not open for proposals" });
    if (error.message === 'ALREADY_APPLIED') return res.status(400).json({ message: "You have already applied to this job" });
    if (error.message === 'WORKER_BUSY_CANNOT_APPLY') return res.status(400).json({ message: "You cannot apply while you have an active job contract" });

    console.error(error);
    return res.status(500).json({ message: "Internal server error", error: error.message, stack: error.stack });
  }
};

exports.list = async (req, res) => {
    try {
        const { jobId } = req.query;
        // If jobId is provided, it must be the client (owner) looking
        if (jobId) {
            // Verify ownership
            const job = await getJobById(jobId);
            if (!job) return res.status(404).json({ message: "Job not found" });
            
            if (job.client_id !== req.user.id && req.user.role?.toLowerCase() !== 'admin') {
                return res.status(403).json({ message: "Unauthorized to view proposals for this job" });
            }

            const proposals = await s.getProposalsByJob(jobId);
            return res.json({ data: proposals });
        }

        // Otherwise, worker looking at their own proposals
        const proposals = await s.getMyProposals(req.user.id);
        return res.json({ data: proposals });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Internal server error" });
    }
};

exports.accept = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await s.acceptProposal(id, req.user.id);
        
        // Send notification to worker
        const io = req.app.get('io');
        await notificationService.createNotification({
            userId: result.proposal.worker_id,
            type: 'PROPOSAL_ACCEPTED',
            title: 'Proposal Accepted',
            message: `Your proposal for "${result.job.title}" has been accepted!`,
            data: { proposalId: id, jobId: result.proposal.job_id, contractId: result.contract.id },
            io
        });
        
        // Send System Message to Chat
        try {
            const conv = await chatService.getOrCreateConversation(req.user.id, result.proposal.worker_id);
            await chatService.sendSystemMessage(conv.id, `🎉 [Hệ thống] Chủ dự án đã chấp nhận đề xuất của bạn cho job "${result.job.title}". Hợp đồng #${result.contract.id} đã được tạo!`, io);
        } catch (chatErr) {
            console.error("Chat system message error:", chatErr);
        }

        return res.json({ message: "Proposal accepted", data: result });
    } catch (e) {
        console.error(e);
        if (e.message === 'PROPOSAL_NOT_FOUND') return res.status(404).json({ message: "Proposal not found" });
        if (e.message === 'unauthorized' || e.message === 'UNAUTHORIZED') return res.status(403).json({ message: "You are not the owner of this job" });
        if (e.message === 'WORKER_HAS_ACTIVE_JOB') return res.status(400).json({ message: "Worker already has an active job" });
        if (e.message === 'INSUFFICIENT_BALANCE') return res.status(400).json({ message: "Insufficient balance to lock funds" });
        return res.status(500).json({ message: "Internal server error" });
    }
};

exports.reject = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await s.rejectProposal(id, req.user.id);
        
        // Notify Worker
        if (result) {
             const job = await getJobById(result.job_id);
             const io = req.app.get('io');
             await notificationService.createNotification({
                userId: result.worker_id,
                type: 'PROPOSAL_REJECTED',
                title: 'Proposal Rejected',
                message: `Your proposal for job "${job ? job.title : 'Unknown'}" was rejected.`,
                data: { proposalId: id, jobId: result.job_id },
                io
            });
        }

        return res.json({ message: "Proposal rejected", data: result });
    } catch (e) {
         console.error(e);
        if (e.message === 'PROPOSAL_NOT_FOUND') return res.status(404).json({ message: "Proposal not found" });
        if (e.message === 'unauthorized' || e.message === 'UNAUTHORIZED') return res.status(403).json({ message: "You are not the owner of this job" });
        return res.status(500).json({ message: "Internal server error" });
    }
};
