const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: "smtp.resend.com",
  port: 587,
  secure: false, // TLS
  auth: {
    user: "resend",
    pass: process.env.RESEND_API_KEY || process.env.MAIL_PASS,
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 20000,
});

console.log('[Mailer Config] Host: resend/gmail, User:', (process.env.RESEND_API_KEY || process.env.MAIL_USER) ? 'SET' : 'MISSING');

module.exports = transporter;
