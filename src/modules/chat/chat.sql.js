module.exports = {
  createConversation: `
    INSERT INTO conversations (type, created_at, updated_at)
    VALUES ($1, NOW(), NOW())
    RETURNING *
  `,

  addParticipant: `
    INSERT INTO conversation_participants (conversation_id, user_id, joined_at)
    VALUES ($1, $2, NOW())
    RETURNING *
  `,

  getConversationBetween: `
    SELECT c.id FROM conversations c
    JOIN conversation_participants p1 ON p1.conversation_id = c.id
    JOIN conversation_participants p2 ON p2.conversation_id = c.id
    WHERE p1.user_id = $1 AND p2.user_id = $2 AND c.type = 'DIRECT'
  `,

  getUserConversations: `
    SELECT c.id, c.type, c.created_at, c.updated_at,
           json_agg(json_build_object('id', u.id, 'email', u.email, 'full_name', up.full_name)) as participants
    FROM conversations c
    JOIN conversation_participants cp ON cp.conversation_id = c.id
    JOIN conversation_participants cp_all ON cp_all.conversation_id = c.id
    JOIN users u ON u.id = cp_all.user_id
    LEFT JOIN user_profiles up ON up.user_id = u.id
    WHERE cp.user_id = $1
    GROUP BY c.id, c.type, c.created_at, c.updated_at
    ORDER BY c.updated_at DESC
  `,

  getUserConversationsSimple: `
    SELECT c.* 
    FROM conversations c
    JOIN conversation_participants cp ON cp.conversation_id = c.id
    WHERE cp.user_id = $1
    ORDER BY c.updated_at DESC
  `,
  
  // This helps getting participant details separately if needed
  getParticipants: `
    SELECT u.id, u.email, up.full_name
    FROM conversation_participants cp
    JOIN users u ON u.id = cp.user_id
    LEFT JOIN user_profiles up ON up.user_id = u.id
    WHERE cp.conversation_id = $1
  `,

  addMessage: `
    INSERT INTO messages (conversation_id, sender_id, content, image_url, created_at)
    VALUES ($1, $2, $3, $4, NOW())
    RETURNING *
  `,

  getMessages: `
    SELECT m.*, u.email as sender_email, up.full_name as sender_name
    FROM messages m
    JOIN users u ON u.id = m.sender_id
    LEFT JOIN user_profiles up ON up.user_id = u.id
    WHERE m.conversation_id = $1
    ORDER BY m.created_at ASC
  `
};
