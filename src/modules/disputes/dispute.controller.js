const s = require("./dispute.service");
const chatService = require("../chat/chat.service");
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary from CLOUDINARY_URL env var
if (process.env.CLOUDINARY_URL) {
    const url = new URL(process.env.CLOUDINARY_URL);
    cloudinary.config({
        cloud_name: url.hostname,
        api_key:    url.username,
        api_secret: url.password,
    });
}

/** Upload a buffer to Cloudinary and return the secure URL */
const uploadToCloudinary = (buffer, folder = 'faf/disputes') => {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder, resource_type: 'auto' },
            (error, result) => {
                if (error) {
                    console.error("Cloudinary upload error:", error);
                    return reject(error);
                }
                resolve(result.secure_url);
            }
        );
        stream.end(buffer);
    });
};

exports.create = async (req, res) => {
    try {
        const { contractId, checkpointId, reason } = req.body;
        const result = await s.createDispute({ contractId, checkpointId, userId: req.user.id, reason });
        
        // Notify other party + Admin
        try {
            const notificationService = require('../notifications/notification.service');
            const { getContractById } = require('../contracts/contract.service');
            const contract = await getContractById(contractId);
            const otherPartyId = (req.user.id === contract.client_id) ? contract.worker_id : contract.client_id;
            const io = req.app.get('io');

            await notificationService.createNotification({
                userId: otherPartyId,
                type: 'DISPUTE_RAISED',
                title: 'Tranh chấp hợp đồng',
                message: `Đối tác đã mở tranh chấp cho hợp đồng #${contractId}. Vui lòng kiểm tra và gửi phản hồi.`,
                data: { disputeId: result.id, contractId },
                io
            });

            // Send System Message to Chat
            try {
                const conv = await chatService.getOrCreateConversation(contract.client_id, contract.worker_id);
                await chatService.sendSystemMessage(conv.id, `⚖️ [Hệ thống] Một tranh chấp đã được mở cho hợp đồng #${contractId}. Vui lòng kiểm tra chat Dispute.`, io);
            } catch (chatErr) {
                console.error("Failed to send system message for dispute:", chatErr);
            }
        } catch (notifyErr) {
            console.error("Failed to notify about dispute creation:", notifyErr);
        }

        return res.status(201).json({ message: "Dispute raised", data: result });
    } catch (e) {
        console.error(e);
        if (e.message === "UNAUTHORIZED") return res.status(403).json({ message: "Unauthorized"});
        if (e.message === "CONTRACT_NOT_FOUND") return res.status(404).json({ message: "Contract not found"});
        return res.status(500).json({ message: "Internal server error" });
    }
};

exports.listAll = async (req, res) => {
    try {
        let result;
        if (req.user.role === 'admin' || req.user.role === 'manager') {
            result = await s.listAll();
        } else {
            result = await s.listByUser(req.user.id);
        }
        return res.json({ data: result });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ message: "Internal server error" });
    }
}

exports.get = async (req, res) => {
    try {
        const { id } = req.params;
        const isManagerOrAdmin = ['admin', 'manager'].includes(req.user.role);
        
        // If manager/admin, we might need a bypass in service or use a different service method
        // For now, let's see if the service allows it.
        const result = await s.getDispute(id, req.user.id);
        
        if (!result && isManagerOrAdmin) {
            // If not found as participant, try fetching as admin (no user check)
            const adminResult = await s.getDisputeAdmin(id);
            if (adminResult) return res.json({ data: adminResult });
        }

        if (!result) return res.status(404).json({ message: "Dispute not found" });
        return res.json({ data: result });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ message: "Internal server error" });
    }
};

exports.addMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const { message } = req.body;
        
        const isManagerOrAdmin = ['admin', 'manager'].includes(req.user.role);
        
        // Verify participation if not manager
        if (!isManagerOrAdmin) {
            const dispute = await s.getDispute(id, req.user.id);
            if (!dispute) return res.status(403).json({ message: "Unauthorized. You are not a participant in this dispute." });
        }

        // Handle file uploads
        let attachmentUrls = [];
        if (req.files && req.files.length > 0) {
            const uploadPromises = req.files.map(file => uploadToCloudinary(file.buffer));
            attachmentUrls = await Promise.all(uploadPromises);
        }

        // Fallback for older JSON clients sending attachments as an array
        let finalAttachments = attachmentUrls;
        if (req.body.attachments && attachmentUrls.length === 0) {
           try {
               finalAttachments = typeof req.body.attachments === 'string' ? JSON.parse(req.body.attachments) : req.body.attachments;
           } catch (e) {
               console.warn("Could not parse req.body.attachments", e);
           }
        }

        const result = await s.addMessage({ disputeId: id, userId: req.user.id, message, attachments: finalAttachments });
        
        // Emit real-time event to everyone viewing the dispute
        const io = req.app.get('io');
        if (io) {
            io.to(`dispute_${id}`).emit('dispute_message', result);
        }

        return res.json({ message: "Message sent", data: result });
  } catch (e) {
        console.error("ADD_MESSAGE_ERROR:", e);
        return res.status(500).json({ message: "Internal server error", error: String(e), stack: e.stack });
    }
};

exports.resolve = async (req, res) => {
    try {
        if (req.user.role !== 'admin' && req.user.role !== 'manager') {
            return res.status(403).json({ message: "Unauthorized. Manager/Admin only." });
        }

        const { id } = req.params;
        const { resolution, resolution_summary } = req.body; // CLIENT_WINS or WORKER_WINS
        
        if (!['CLIENT_WINS', 'WORKER_WINS'].includes(resolution)) {
            return res.status(400).json({ message: "Invalid resolution. Must be CLIENT_WINS or WORKER_WINS" });
        }
        
        const io = req.app.get('io');
        const result = await s.resolveDispute({ 
            disputeId: id, 
            resolution, 
            adminId: req.user.id,
            io,
            resolutionSummary: resolution_summary
        });

        // Send System Message to Chat
        try {
            const { getContractById } = require('../contracts/contract.service');
            const contract = await getContractById(result.contract_id);
            const conv = await chatService.getOrCreateConversation(contract.client_id, contract.worker_id);
            const winner = resolution === 'CLIENT_WINS' ? 'Chủ dự án' : 'Worker';
            await chatService.sendSystemMessage(conv.id, `⚖️ [Hệ thống] Tranh chấp cho hợp đồng #${result.contract_id} đã được phân xử: **${winner} thắng**.`, io);
        } catch (chatErr) {
            console.error("Failed to send resolution message:", chatErr);
        }

        if (io) {
            io.to(`dispute_${id}`).emit('dispute_resolved', result);
        }

        return res.json({ message: "Dispute resolved", data: result });
    } catch (e) {
        console.error(e);
        if (e.message === "DISPUTE_NOT_FOUND") return res.status(404).json({ message: "Dispute not found" });
        return res.status(500).json({ message: "Internal server error", error: e.message });
    }
};
