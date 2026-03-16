const nodemailer = require('nodemailer');
const fs = require('fs');

const logFile = 'ethereal.log';
function log(msg) {
  console.log(msg);
  fs.appendFileSync(logFile, msg + '\n');
}

async function testConnection() {
  if (fs.existsSync(logFile)) fs.unlinkSync(logFile);
  log('--- SMTP Global/Ethereal Test ---');

  // Test Ethereal (Fake SMTP)
  log('\nCreating Ethereal Test Account...');
  try {
    let testAccount = await nodemailer.createTestAccount();
    log('Ethereal Account Created.');
    
    const transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false, 
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
      connectionTimeout: 5000,
    });

    log('Testing Ethereal SMTP...');
    await transporter.verify();
    log('✅ Ethereal SMTP SUCCESS!');
    
  } catch (err) {
    log('❌ Ethereal FAILED: ' + err.message);
  }
}

testConnection();
