const s = require("./checkpoint.service");
const notificationService = require('../notifications/notification.service');
const chatService = require('../chat/chat.service');

exports.submit = async (req, res) => {
  try {
    const { id } = req.params; // Checkpoint ID
    const { submission_url, submission_notes } = req.body;
    const workerId = req.user.id;

    if (!submission_url) return res.status(400).json({ message: "submission_url required" });

    const result = await s.submitWork({ 
        checkpointId: id, 
        workerId, 
        submissionData: { submission_url, submission_notes } 
    });

    // Notify Client
    const io = req.app.get('io');
    
    // To get client_id correctly, we fetch the job
    const { rows: cpData } = await require('../../config/database').query(`
        SELECT j.client_id, j.title as job_title, cp.title as cp_title 
        FROM checkpoints cp
        JOIN contracts c ON cp.contract_id = c.id
        JOIN jobs j ON c.job_id = j.id
        WHERE cp.id = $1
    `, [id]);
    
    if (cpData[0]) {
        await notificationService.createNotification({
            userId: cpData[0].client_id,
            type: 'CHECKPOINT_SUBMITTED',
            title: 'Bài nộp mới',
            message: `Worker đã nộp bài cho giai đoạn "${cpData[0].cp_title}" của job "${cpData[0].job_title}"`,
            data: { checkpointId: id },
            io
        });
    }

    return res.json({ message: "Work submitted", data: result });


  } catch (error) {
    console.error(error);
    if (error.message === 'UNAUTHORIZED') return res.status(403).json({ message: "Unauthorized" });
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.approve = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await s.approveWork(id, req.user.id);
    
    const io = req.app.get('io');

    // Notify Worker (Always notify on approval)
    await notificationService.createNotification({
        userId: result.workerId,
        type: 'CHECKPOINT_APPROVED',
        title: 'Giai đoạn được duyệt',
        message: `Giai đoạn đã được duyệt cho job "${result.jobTitle}". Tiền đã được chuyển vào ví của bạn.`,
        data: { checkpointId: id, contractId: result.contractId },
        io
    });

    // Send System Message to Chat
    try {
        const conv = await chatService.getOrCreateConversation(result.clientId, result.workerId);
        await chatService.sendSystemMessage(conv.id, `✅ [Hệ thống] Giai đoạn "${result.jobTitle}" đã được duyệt.`, io);
    } catch (chatErr) {
        console.error("Failed to send system message:", chatErr);
    }

    // If contract is completed, send additional notifications
    if (result.contractCompleted) {
        // Notify Client
        await notificationService.createNotification({
            userId: result.clientId,
            type: 'CONTRACT_COMPLETED',
            title: 'Hợp đồng hoàn tất',
            message: `Hợp đồng cho công việc "${result.jobTitle}" đã hoàn tất. Bạn có thể để lại đánh giá cho Worker.`,
            data: { contractId: result.contractId },
            io
        });

        // Notify Worker additional message
        await notificationService.createNotification({
            userId: result.workerId,
            type: 'CONTRACT_COMPLETED',
            title: 'Công việc hoàn tất',
            message: `Chúc mừng! Công việc "${result.jobTitle}" đã hoàn thành xuất sắc. Hãy để lại đánh giá cho Client.`,
            data: { contractId: result.contractId },
            io
        });
    }

    return res.json(result);
  } catch (error) {
    console.error(error);
    if (error.message === 'UNAUTHORIZED') return res.status(403).json({ message: "Unauthorized" });
    if (error.message === 'ALREADY_APPROVED') return res.status(400).json({ message: "Already approved" });
    return res.status(500).json({ message: "Internal server error" });
  }
};

exports.reject = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await s.rejectWork(id, req.user.id);
    
    // Notify Worker
    const { rows: cpData } = await require('../../config/database').query(`
        SELECT c.worker_id, j.title as job_title, cp.title as cp_title 
        FROM checkpoints cp
        JOIN contracts c ON cp.contract_id = c.id
        JOIN jobs j ON c.job_id = j.id
        WHERE cp.id = $1
    `, [id]);

    if (cpData[0]) {
        const io = req.app.get('io');
        await notificationService.createNotification({
            userId: cpData[0].worker_id,
            type: 'CHECKPOINT_REJECTED',
            title: 'Yêu cầu chỉnh sửa',
            message: `Bài nộp cho giai đoạn "${cpData[0].cp_title}" của job "${cpData[0].job_title}" đã bị từ chối/yêu cầu sửa lại.`,
            data: { checkpointId: id },
            io
        });

        // Send System Message
        try {
            const conv = await chatService.getOrCreateConversation(req.user.id, cpData[0].worker_id);
            await chatService.sendSystemMessage(conv.id, `❌ [Hệ thống] Giai đoạn "${cpData[0].cp_title}" đã bị từ chối/yêu cầu chỉnh sửa.`, io);
        } catch (chatErr) {
            console.error("Failed to send system message:", chatErr);
        }
    }

    return res.json({ message: "Work rejected", data: result });
  } catch (error) {
    console.error(error);
    if (error.message === 'UNAUTHORIZED') return res.status(403).json({ message: "Unauthorized" });
    return res.status(500).json({ message: "Internal server error" });
  }
};

