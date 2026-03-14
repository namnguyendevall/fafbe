module.exports = {
  findUserByEmail: `
    SELECT * FROM users WHERE email = $1
  `,
  createUser: `
    INSERT INTO users (email, password_hash, role)
    VALUES ($1, $2, $3)
    RETURNING *
  `,
  insertOtp: `
    INSERT INTO otps (email, otp_hash, expires_at)
    VALUES ($1, $2, NOW() + INTERVAL '15 minutes')
  `,
  findValidOtp: `
    SELECT * FROM otps
    WHERE email = $1 AND is_used = false AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1
  `,
  verifyUserEmail: `
    UPDATE users
    SET email_verified = true, status = 'ACTIVE'
    WHERE email = $1
  `,
  markOtpUsed: `
    UPDATE otps SET is_used = true WHERE id = $1
  `,
  activateUser: `
    UPDATE users
    SET email_verified = true,
        status = 'ACTIVE'
    WHERE email = $1
  `,

  updatePassword: `
    UPDATE users
    SET password_hash = $2
    WHERE email = $1
  `,
  updateLastLogin: `
    UPDATE users SET last_login = NOW() WHERE id = $1
  `
};
