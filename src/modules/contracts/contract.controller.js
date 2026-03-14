const s = require("./contract.service");
const notificationService = require('../notifications/notification.service');
const chatService = require('../chat/chat.service');
const authService = require('../auth/auth.service');
const userService = require('../users/user.service');

exports.updateContent = async (req, res) => {
    try {
        const { id } = req.params;
        const { content } = req.body;
        const result = await s.updateContent({ contractId: id, userId: req.user.id, content });
        return res.json({ message: "Contract updated", data: result });
    } catch (e) {
        console.error(e);
        if (e.message === "UNAUTHORIZED") return res.status(403).json({ message: "Unauthorized" });
        if (e.message === "CANNOT_UPDATE_SIGNED_CONTRACT") return res.status(400).json({ message: "Cannot update signed contract" });
        return res.status(500).json({ message: "Internal server error" });
    }
};

exports.requestSignOtp = async (req, res) => {
    try {
        const user = await userService.getMyProfile(req.user.id);
        if (!user) return res.status(404).json({ message: "User not found" });
        
        await authService.sendOtp(user.email, 'FAF - Xác nhận ký hợp đồng');
        return res.json({ message: "OTP sent to your email" });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ message: "Internal server error" });
    }
};

exports.sign = async (req, res) => {
    try {
        const { id } = req.params;
        const { otp } = req.body;

        if (!otp) {
            return res.status(400).json({ message: "Mã OTP là bắt buộc" });
        }

        const user = await userService.getMyProfile(req.user.id);
        if (!user) return res.status(404).json({ message: "User not found" });

        try {
            await authService.verifyOtpOnly(user.email, otp);
        } catch (otpErr) {
            return res.status(400).json({ message: otpErr.message === 'OTP invalid' ? 'Mã OTP không hợp lệ hoặc đã hết hạn' : 'Mã OTP không chính xác' });
        }

        const result = await s.signContract({ contractId: id, userId: req.user.id });
        
        // Send System Message
        try {
            const io = req.app.get('io');
            const conv = await chatService.getOrCreateConversation(result.client_id, result.worker_id);
            const signerName = req.user.role === 'employer' ? 'Client' : 'Worker';
            await chatService.sendSystemMessage(conv.id, `✍️ [Hệ thống] ${signerName} đã ký hợp đồng #${id}.`, io);
        } catch (chatErr) {
            console.error("Chat error:", chatErr);
        }

        return res.json({ message: "Contract signed", data: result });
    } catch (e) {
        console.error(e);
         if (e.message === "UNAUTHORIZED") return res.status(403).json({ message: "Unauthorized" });
        return res.status(500).json({ message: "Internal server error" });
    }
};

exports.get = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await s.getContract(id);
        if (!result) return res.status(404).json({ message: "Contract not found" });
        return res.json({ data: result });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ message: "Internal server error" });
    }
};

exports.getMyActiveContract = async (req, res) => {
    try {
        const result = await s.getActiveContractByWorker(req.user.id);
        if (!result) return res.json({ data: null });
        return res.json({ data: result });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ message: "Internal server error" });
    }
};

exports.getContractByJob = async (req, res) => {
    try {
        const { jobId } = req.params;
        const result = await s.getContractByJobAndWorker(jobId, req.user.id);
        if (!result) return res.json({ data: null });
        return res.json({ data: result });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ message: "Internal server error" });
    }
};

exports.getMyContracts = async (req, res) => {
    try {
        const result = await s.getContractsByUser(req.user.id);
        return res.json({ data: result });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ message: "Internal server error" });
    }
};

exports.submitCheckpoint = async (req, res) => {
    try {
        const { id } = req.params;
        const { submission_url, submission_notes } = req.body;
        
        if (!submission_url) {
            return res.status(400).json({ message: "Submission URL is required" });
        }

        const result = await s.submitCheckpoint({
            checkpointId: id,
            workerId: req.user.id,
            submissionUrl: submission_url,
            submissionNotes: submission_notes || ''
        });
        
        // Notify Client
        const contract = await s.getContract(result.contract_id);
        if (contract) {
            const io = req.app.get('io');
            await notificationService.createNotification({
                userId: contract.client_id,
                type: 'CHECKPOINT_SUBMITTED',
                title: 'Work Submitted',
                message: `Worker has submitted work for checkpoint "${result.title}"`,
                data: { checkpointId: result.id, contractId: contract.id },
                io
            });
        }
        
        return res.json({ message: "Checkpoint submitted successfully", data: result });
    } catch (e) {
        console.error(e);
        if (e.message === "CHECKPOINT_NOT_FOUND") return res.status(404).json({ message: "Checkpoint not found" });
        if (e.message === "UNAUTHORIZED") return res.status(403).json({ message: "Unauthorized" });
        if (e.message === "CHECKPOINT_ALREADY_SUBMITTED") return res.status(400).json({ message: "Checkpoint already submitted" });
        return res.status(500).json({ message: "Internal server error" });
    }
};

exports.approveCheckpoint = async (req, res) => {
    try {
        const { id } = req.params;
        const { review_notes } = req.body;

        const result = await s.approveCheckpoint({
            checkpointId: id,
            clientId: req.user.id,
            reviewNotes: review_notes || 'Approved'
        });
        
        // Notify Worker
        const contract = await s.getContract(result.contract_id);
        if (contract) {
            const io = req.app.get('io');
            await notificationService.createNotification({
                userId: contract.worker_id,
                type: 'CHECKPOINT_APPROVED',
                title: 'Work Approved',
                message: `Your work for checkpoint "${result.title}" has been approved! Funds released.`,
                data: { checkpointId: result.id, contractId: contract.id },
                io
            });
        }

        // Send System Message
        if (contract) {
            try {
                const conv = await chatService.getOrCreateConversation(contract.client_id, contract.worker_id);
                await chatService.sendSystemMessage(conv.id, `✅ [Hệ thống] Giai đoạn "${result.title}" đã được duyệt.`, req.app.get('io'));
            } catch (chatErr) { console.error(chatErr); }
        }

        return res.json({ message: "Checkpoint approved successfully", data: result });
    } catch (e) {
        console.error(e);
        if (e.message === "CHECKPOINT_NOT_FOUND") return res.status(404).json({ message: "Checkpoint not found" });
        if (e.message === "UNAUTHORIZED") return res.status(403).json({ message: "Unauthorized" });
        if (e.message === "CHECKPOINT_NOT_SUBMITTED") return res.status(400).json({ message: "Checkpoint not submitted yet" });
        return res.status(500).json({ message: "Internal server error" });
    }
};

exports.rejectCheckpoint = async (req, res) => {
    try {
        const { id } = req.params;
        const { review_notes, reason } = req.body;

        if (!review_notes) {
            return res.status(400).json({ message: "Review notes are required for rejection" });
        }

        const result = await s.rejectCheckpoint({
            checkpointId: id,
            clientId: req.user.id,
            reviewNotes: review_notes,
            reason: reason || ''
        });
        
        // Notify Worker
        const contract = await s.getContract(result.contract_id);
        if (contract) {
            const io = req.app.get('io');
            await notificationService.createNotification({
                userId: contract.worker_id,
                type: 'CHECKPOINT_REJECTED',
                title: 'Work Rejected',
                message: `Your work for checkpoint "${result.title}" was rejected. Please review notes.`,
                data: { checkpointId: result.id, contractId: contract.id },
                io
            });
        }
        
        // Send System Message
        if (contract) {
            try {
                const conv = await chatService.getOrCreateConversation(contract.client_id, contract.worker_id);
                await chatService.sendSystemMessage(conv.id, `❌ [Hệ thống] Giai đoạn "${result.title}" đã bị từ chối: ${review_notes}`, req.app.get('io'));
            } catch (chatErr) { console.error(chatErr); }
        }
        
        return res.json({ message: "Checkpoint rejected", data: result });
    } catch (e) {
        console.error(e);
        if (e.message === "CHECKPOINT_NOT_FOUND") return res.status(404).json({ message: "Checkpoint not found" });
        if (e.message === "UNAUTHORIZED") return res.status(403).json({ message: "Unauthorized" });
        if (e.message === "CHECKPOINT_NOT_SUBMITTED") return res.status(400).json({ message: "Checkpoint not submitted yet" });
        return res.status(500).json({ message: "Internal server error" });
    }
};

exports.requestSettlement = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await s.requestSettlement({ contractId: id, workerId: req.user.id });
        return res.json({ message: "Settlement requested", data: result });
    } catch (e) {
        console.error(e);
        if (e.message === "CONTRACT_NOT_FOUND") return res.status(404).json({ message: "Contract not found" });
        if (e.message === "UNAUTHORIZED") return res.status(403).json({ message: "Unauthorized" });
        if (e.message === "CONTRACT_NOT_ACTIVE") return res.status(400).json({ message: "Contract is not active" });
        return res.status(500).json({ message: "Internal server error" });
    }
};

exports.finalizeSettlement = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await s.finalizeSettlement({ contractId: id, clientId: req.user.id });
        return res.json({ message: "Contract finalized", data: result });
    } catch (e) {
        console.error(e);
        if (e.message === "CONTRACT_NOT_FOUND") return res.status(404).json({ message: "Contract not found" });
        if (e.message === "UNAUTHORIZED") return res.status(403).json({ message: "Unauthorized" });
        if (e.message === "CONTRACT_NOT_ACTIVE") return res.status(400).json({ message: "Contract is not active" });
        return res.status(500).json({ message: "Internal server error" });
    }
};

exports.terminateContract = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await s.terminateContract({
            contractId: id,
            clientId: req.user.id
        });
        
        // Notify Worker
        const contract = await s.getContract(id); 
        if (contract) {
             const io = req.app.get('io');
             await notificationService.createNotification({
                userId: contract.worker_id,
                type: 'CONTRACT_TERMINATED',
                title: 'Contract Terminated',
                message: `Contract #${id} has been terminated by the client.`,
                data: { contractId: id },
                io
            });

            // Send System Message
            try {
                const conv = await chatService.getOrCreateConversation(contract.client_id, contract.worker_id);
                await chatService.sendSystemMessage(conv.id, `🚫 [Hệ thống] Hợp đồng #${id} đã bị chấm dứt bởi Client.`, io);
            } catch (chatErr) { console.error(chatErr); }
        }

        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: error.message });
    }
};
