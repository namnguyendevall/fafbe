module.exports = {
  getByUserId: `
    SELECT * FROM wallets WHERE user_id = $1
  `,

  updateBalance: `
    UPDATE wallets 
    SET balance_points = balance_points + $2, 
        updated_at = NOW()
    WHERE user_id = $1
    RETURNING *
  `,

  updateLocked: `
    UPDATE wallets 
    SET locked_points = locked_points + $2, 
        updated_at = NOW()
    WHERE user_id = $1
    RETURNING *
  `,

  lockFunds: `
    UPDATE wallets 
    SET balance_points = balance_points - $2,
        locked_points = locked_points + $2,
        updated_at = NOW()
    WHERE user_id = $1 AND balance_points >= $2
    RETURNING *
  `,

  unlockFunds: `
    UPDATE wallets 
    SET balance_points = balance_points + $2,
        locked_points = locked_points - $2,
        updated_at = NOW()
    WHERE user_id = $1 AND locked_points >= $2
    RETURNING *
  `,

  releaseFunds: `
    UPDATE wallets 
    SET locked_points = locked_points - $2,
        updated_at = NOW()
    WHERE user_id = $1 AND locked_points >= $2
    RETURNING *
  `,

  createTransaction: `
    INSERT INTO transactions (wallet_id, type, amount, status, reference_type, reference_id, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, NOW())
    RETURNING *
  `,

  createWithdrawalRequest: `
    INSERT INTO withdrawal_requests (user_id, amount, bank_info, status)
    VALUES ($1, $2, $3, 'PENDING')
    RETURNING *
  `,

  listWithdrawalRequests: `
    SELECT wr.*, u.email as user_email
    FROM withdrawal_requests wr
    JOIN users u ON wr.user_id = u.id
    ORDER BY wr.created_at DESC
  `,

  getWithdrawalRequestById: `
    SELECT * FROM withdrawal_requests WHERE id = $1
  `,

  updateWithdrawalStatus: `
    UPDATE withdrawal_requests 
    SET status = $2, admin_note = $3, updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `,
  listMyTransactions: `
    SELECT t.* 
    FROM transactions t
    JOIN wallets w ON t.wallet_id = w.id
    WHERE w.user_id = $1
    ORDER BY t.created_at DESC
    LIMIT 50
  `
};
