const pool = require("../../config/database");
const sql = require("./notification.sql");

exports.createNotification = async ({ userId, type, title, message, data, io }) => {
    // Defensive check for message to avoid DB constraint violation
    const finalMessage = message || title || "New notification from FAF";
    const dataJson = data ? JSON.stringify(data) : null;
    const { rows } = await pool.query(sql.create, [userId, type, title, finalMessage, dataJson]);
    const notification = rows[0];
    
    // Emit realtime notification via Socket.io
    if (io) {
        io.to(`user_${userId}`).emit('new_notification', notification);
    }
    
    return notification;
};

exports.getUserNotifications = async (userId, limit = 20, offset = 0) => {
    const { rows } = await pool.query(sql.getUserNotifications, [userId, limit, offset]);
    return rows;
};

exports.markAsRead = async (notificationId, userId) => {
    const { rows } = await pool.query(sql.markAsRead, [notificationId, userId]);
    return rows[0];
};

exports.markAllAsRead = async (userId) => {
    const { rows } = await pool.query(sql.markAllAsRead, [userId]);
    return rows;
};
