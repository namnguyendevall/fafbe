const s = require("./chat.service");
const notificationService = require("../notifications/notification.service");

exports.getConversations = async (req, res) => {
    try {
        const result = await s.getUserConversations(req.user.id);
        return res.json({ data: result });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ message: "Internal server error" });
    }
};

exports.getMessages = async (req, res) => {
    try {
        const { id } = req.params;
        const result = await s.getMessages(id, req.user.id);
        return res.json({ data: result });
    } catch (e) {
        console.error(e);
        if (e.message === "UNAUTHORIZED") return res.status(403).json({ message: "Unauthorized" });
        return res.status(500).json({ message: "Internal server error" });
    }
};

// Create Conversation (Start Chat)
exports.startChat = async (req, res) => {
    try {
        const { otherUserId } = req.body;
        if (!otherUserId) return res.status(400).json({ message: "otherUserId required" });

        const result = await s.getOrCreateConversation(req.user.id, otherUserId);
        return res.json({ data: result });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ message: "Internal server error" });
    }
};
// Send Message via HTTP (Alternative to Socket.io)
exports.sendMessage = async (req, res) => {
    try {
        const { id } = req.params;
        const { content, image_url } = req.body;
        if (!content && !image_url) return res.status(400).json({ message: "Content or Image required" });
        
        const message = await s.saveMessage(id, req.user.id, content, image_url);
        
        // Notify via socket if io is available
        const io = req.app.get('io');
        if (io) {
            io.to(`conversation_${id}`).emit('receive_message', message);
            
            // Create Notifications for other participants
            try {
                const participants = await s.getParticipants(id);
                for (const p of participants) {
                    if (p.user_id !== req.user.id) {
                        await notificationService.createNotification({
                            userId: p.user_id,
                            type: 'NEW_MESSAGE',
                            title: 'New Message',
                            message: `You have a new message`,
                            data: { conversationId: id, messageId: message.id },
                            io
                        });
                    }
                }
            } catch (notifyErr) {
                console.error("Notification failed in HTTP sendMessage:", notifyErr);
            }
        }
        
        return res.json({ data: message });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ message: "Internal server error" });
    }
};
