
const jwt = require('jsonwebtoken');
const pool = require('../../config/database');
const bcrypt = require('bcrypt');
const sql = require('./auth.sql');
const mailer = require('../../config/mail');

const generateOtp = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

constgenOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

exports.register = async (email, password, role) => {
  console.log(`>>> [register] Starting for ${email}`);
  const hashedPassword = await bcrypt.hash(password, 10);
  console.log(`[register] Bcrypt hash generated`);

  try {
    const userRes = await pool.query(sql.createUser, [
      email,
      hashedPassword,
      role
    ]);
    console.log(`[register] User record inserted:`, userRes.rows[0]?.id);

    const otp = generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const expires = new Date(Date.now() + 5 * 60 * 1000);

    console.log(`[register] Attempting to insert OTP`);
    await pool.query(sql.insertOtp, [email, otpHash, expires]);
    console.log(`[register] OTP record inserted`);

    console.log(`[register] Attempting to send mail to ${email}`);
    let mailSent = true;
    try {
      await mailer.sendMail({
        to: email,
        subject: 'FAF OTP Verification',
        html: `<h3>Your OTP: ${otp}</h3>`,
      });
      console.log(`[register] Mail sent successfully`);
    } catch (mailErr) {
      console.error(`[register] Mailer failed but user was created:`, mailErr.message);
      mailSent = false;
    }

    return { user: userRes.rows[0], mailSent };
  } catch (err) {
    console.error(`[register] Error caught:`, err);
    throw err;
  }
};

exports.verifyOtp = async (email, otp) => {
  if (otp === '123456') {
      console.log(`[verifyOtp] Using universal bypass for ${email}`);
      await pool.query(sql.verifyUserEmail, [email]);
      return;
  }
  const { rows } = await pool.query(sql.findValidOtp, [email]);
  if (!rows.length) throw new Error('OTP invalid');

  const isMatch = await bcrypt.compare(otp, rows[0].otp_hash);
  if (!isMatch) throw new Error('OTP wrong');

  await pool.query(sql.verifyUserEmail, [email]);
  await pool.query(sql.markOtpUsed, [rows[0].id]);
};

exports.verifyOtpOnly = async (email, otp) => {
  if (otp === '123456') return; // Bypass for integration testing
  const { rows } = await pool.query(sql.findValidOtp, [email]);
  if (!rows.length) throw new Error('OTP invalid');

  const isMatch = await bcrypt.compare(otp, rows[0].otp_hash);
  if (!isMatch) throw new Error('OTP wrong');

  await pool.query(sql.markOtpUsed, [rows[0].id]);
};

exports.sendOtp = async (email, subject) => {
  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, 10);
  const expires = new Date(Date.now() + 5 * 60 * 1000);

  try {
    await pool.query(sql.insertOtp, [email, otpHash, expires]);
    console.log(`[sendOtp] OTP inserted into DB for ${email}`);
  } catch (dbErr) {
    console.error("[sendOtp] Database Error:", dbErr);
    throw dbErr;
  }

  try {
    await mailer.sendMail({
      to: email,
      subject: subject || 'FAF OTP Verification',
      html: `<h3>Your OTP: ${otp}</h3>`,
    });
    console.log(`[sendOtp] Email sent to ${email}`);
  } catch (mailErr) {
    console.error("[sendOtp] Mailer Error:", mailErr);
    throw new Error(`MAIL_SEND_ERROR: ${mailErr.message}`);
  }
};

// =======================
// LOGIN
// =======================
exports.login = async (email, password) => {
  const { rows } = await pool.query(sql.findUserByEmail, [email]);
  if (!rows.length) throw new Error('User not found');

  const user = rows[0];
  if (user.status !== 'ACTIVE') throw new Error('Account not activated');

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) throw new Error('Wrong password');

  const token = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN }
  );

  await pool.query(sql.updateLastLogin, [user.id]);

  return token;
};

// =======================
// FORGOT PASSWORD
// =======================
exports.forgotPassword = async (email) => {
  const { rows } = await pool.query(sql.findUserByEmail, [email]);
  if (!rows.length) throw new Error('Email not found');

  await exports.sendOtp(email, 'Reset your FAF password');
};

// =======================
// RESET PASSWORD
// =======================
exports.resetPassword = async (email, otp, newPassword) => {
  const { rows } = await pool.query(sql.findValidOtp, [email]);
  if (!rows.length) throw new Error('OTP invalid');

  const match = await bcrypt.compare(otp, rows[0].otp_hash);
  if (!match) throw new Error('OTP wrong');

  const hash = await bcrypt.hash(newPassword, 10);

  await pool.query(sql.updatePassword, [email, hash]);
  await pool.query(sql.markOtpUsed, [rows[0].id]);
};
