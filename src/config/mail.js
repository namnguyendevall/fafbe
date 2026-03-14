const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // TLS
  auth: {
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false
  },
  // Force IPv4 to avoid Gmail IPv6 issues in cloud/local environments
  family: 4, 
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 20000,
});

console.log('[Mailer Config] Host: smtp.gmail.com, Port: 587, User:', process.env.MAIL_USER ? 'SET' : 'MISSING');

module.exports = transporter;
