const axios = require('axios');

const mailer = {
  sendMail: async ({ to, subject, html }) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.error('[Mailer] ERROR: RESEND_API_KEY is missing in environment variables.');
      return;
    }

    try {
      // Note: By default Resend only sends from 'onboarding@resend.dev' to the account owner
      // Unless you have verified your own domain.
      const response = await axios.post('https://api.resend.com/emails', {
        from: 'FAF Account <onboarding@resend.dev>',
        to: to,
        subject: subject,
        html: html,
      }, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      });
      console.log('[Mailer] SUCCESS: Email sent via Resend HTTPS API. ID:', response.data.id);
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      console.error('[Mailer] FAILED via HTTPS:', errorMsg);
      console.log(`[Mailer] TO: ${to}, CONTENT: ${html}`); // Log content so dev can see OTP
      if (err.response?.status === 401) {
        console.error('[Mailer] HINT: Your RESEND_API_KEY might be invalid.');
      }
    }
  }
};

console.log('[Mailer Config] Method: Resend HTTPS API, API_KEY:', process.env.RESEND_API_KEY ? 'SET' : 'MISSING');

module.exports = mailer;
