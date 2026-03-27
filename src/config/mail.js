const nodemailer = require('nodemailer');

const mailer = {
  sendMail: async ({ to, subject, html }) => {
    const user = process.env.MAIL_USER;
    const pass = process.env.MAIL_PASS;
    const host = process.env.MAIL_HOST || 'smtp-relay.brevo.com';
    const port = parseInt(process.env.MAIL_PORT || '587');

    if (!user || !pass) {
      console.error('[Mailer] ERROR: MAIL_USER or MAIL_PASS is missing. Falling back to console log.');
      console.log(`[MAIL LOG] TO: ${to}, SUBJECT: ${subject}, HTML: ${html}`);
      return;
    }

    try {
      const transporter = nodemailer.createTransport({
        host: host,
        port: port,
        secure: port === 465, // true for 465, false for 587
        auth: {
          user: user,
          pass: pass,
        },
      });

      const info = await transporter.sendMail({
        from: `"FAF System" <${process.env.MAIL_FROM || user}>`,
        to,
        subject,
        html,
      });

      console.log('[Mailer] SUCCESS: Email sent via SMTP. MessageId:', info.messageId);
    } catch (err) {
      console.error('[Mailer] FAILED via SMTP:', err.message);
      console.log(`[Mailer Fallback] TO: ${to}, CONTENT: ${html}`);
    }
  }
};

console.log('[Mailer Config] Method: Nodemailer SMTP, USER:', process.env.MAIL_USER ? 'SET' : 'MISSING');

module.exports = mailer;
