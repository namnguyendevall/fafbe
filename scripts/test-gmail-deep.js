const nodemailer = require('nodemailer');
const fs = require('fs');
const dotenv = require('dotenv');
const util = require('util');
dotenv.config();

const logFile = 'gmail_debug.log';
if (fs.existsSync(logFile)) fs.unlinkSync(logFile);
function log(msg) {
  const text = typeof msg === 'string' ? msg : util.inspect(msg, { depth: null });
  console.log(text);
  fs.appendFileSync(logFile, text + '\n');
}

async function testGmail() {
  log('--- Gmail SMTP Deep Debug ---');

  const config = {
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS,
    },
    tls: {
      rejectUnauthorized: false,
      family: 4 // Force IPv4
    },
    connectionTimeout: 10000,
    debug: true,
    logger: {
      info: (m) => log('INF: ' + util.inspect(m)),
      warn: (m) => log('WRN: ' + util.inspect(m)),
      error: (m) => log('ERR: ' + util.inspect(m)),
    }
  };

  log('\nAttempting connection...');
  try {
      const transporter = nodemailer.createTransport(config);
      await transporter.verify();
      log('✅ Gmail SUCCESS!');
  } catch (err) {
      log('❌ Gmail FAILED: ' + err.message);
      log('Code: ' + err.code);
  }
}

testGmail().catch(e => log('GLOBAL ERROR: ' + e.stack));
