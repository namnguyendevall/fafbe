const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // TLS
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
  requireTLS: true,
  connectionTimeout: 5000,
  greetingTimeout: 5000,
  socketTimeout: 10000,
});

module.exports = transporter;
