const pool = require("../../config/database");
const sql = require("./chat.sql");

exports.getOrCreateConversation = async (userId, otherUserId) => {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        // Check existing
        const existing = await client.query(sql.getConversationBetween, [userId, otherUserId]);
        if (existing.rows.length > 0) {
            await client.query("COMMIT");
            return existing.rows[0]; // Return { id: ... }
        }

        // Create New
        const convRes = await client.query(sql.createConversation, ['DIRECT']);
        const convId = convRes.rows[0].id;

        await client.query(sql.addParticipant, [convId, userId]);
        await client.query(sql.addParticipant, [convId, otherUserId]);

        await client.query("COMMIT");
        return convRes.rows[0];
    } catch (e) {
        await client.query("ROLLBACK");
        throw e;
    } finally {
        client.release();
    }
};

exports.getUserConversations = async (userId) => {
    // Simplified fetch: get IDs then populate? Or use the complex query?
    // Let's use the complex query in SQL
    const { rows } = await pool.query(sql.getUserConversations, [userId]);
    return rows;
};

exports.getMessages = async (conversationId, userId) => {
    // 1. Verify access
    const accessCheck = await pool.query('SELECT * FROM conversation_participants WHERE conversation_id = $1 AND user_id = $2', [conversationId, userId]);
    if (accessCheck.rows.length === 0) throw new Error("UNAUTHORIZED");

    const { rows } = await pool.query(sql.getMessages, [conversationId]);
    return rows;
};

exports.saveMessage = async (conversationId, senderId, content, imageUrl) => {
    const { rows } = await pool.query(sql.addMessage, [conversationId, senderId, content || '', imageUrl || null]);
    return rows[0];
};

exports.getParticipants = async (conversationId) => {
    const { rows } = await pool.query('SELECT user_id FROM conversation_participants WHERE conversation_id = $1', [conversationId]);
    return rows;
};

exports.sendSystemMessage = async (conversationId, content, io) => {
    const { rows } = await pool.query(
        'INSERT INTO messages (conversation_id, sender_id, content, type) VALUES ($1, $2, $3, $4) RETURNING *',
        [conversationId, null, content, 'SYSTEM']
    );
    const message = rows[0];
    if (io) {
        io.to(`conversation_${conversationId}`).emit('receive_message', message);
    }
    return message;
};
