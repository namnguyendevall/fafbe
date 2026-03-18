const s = require("./chat.service");

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
        const { content } = req.body;
        if (!content) return res.status(400).json({ message: "Content required" });
        
        const message = await s.saveMessage(id, req.user.id, content);
        
        // Notify via socket if io is available
        const io = req.app.get('io');
        if (io) {
            io.to(`conversation_${id}`).emit('receive_message', message);
        }
        
        return res.json({ data: message });
    } catch (e) {
        console.error(e);
        return res.status(500).json({ message: "Internal server error" });
    }
};
