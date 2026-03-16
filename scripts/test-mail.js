const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
const fs = require('fs');
dotenv.config();

const logFile = 'smtp_test.log';
function log(msg) {
  console.log(msg);
  fs.appendFileSync(logFile, msg + '\n');
}

async function testConnection() {
  if (fs.existsSync(logFile)) fs.unlinkSync(logFile);
  log('--- SMTP Diagnostic Test ---');
  log('User: ' + process.env.MAIL_USER);
  
  const configs = [
    {
      name: 'Gmail Service',
      service: 'gmail',
      auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS }
    },
    {
      name: 'SMTP Port 587',
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS }
    },
    {
      name: 'SMTP Port 465',
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS }
    }
  ];

  for (const config of configs) {
    log(`\nTesting: ${config.name}...`);
    const transporter = nodemailer.createTransport({
      ...config,
      connectionTimeout: 5000,
    });

    try {
      await transporter.verify();
      log(`✅ ${config.name} SUCCESS!`);
    } catch (err) {
      log(`❌ ${config.name} FAILED: ${err.message}`);
      if (err.code === 'ETIMEDOUT') {
        log('   Hint: Network Timeout.');
      } else if (err.code === 'EAUTH') {
        log('   Hint: Authentication Failed.');
      }
    }
  }
}

testConnection();
