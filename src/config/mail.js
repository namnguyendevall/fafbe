const mailer = {
  sendMail: async ({ to, subject, html }) => {
    // Brevo API Key (must be generated from Brevo Dashboard -> SMTP & API)
    const apiKey = process.env.BREVO_API_KEY; 
    const senderEmail = process.env.MAIL_FROM || 'faf.system@example.com';

    if (!apiKey) {
      console.error('[Mailer] ERROR: BREVO_API_KEY is missing. Falling back to console log.');
      console.log(`[MAIL LOG] TO: ${to}, SUBJECT: ${subject}, HTML: ${html}`);
      return;
    }

    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': apiKey,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          sender: { email: senderEmail, name: 'FAF System' },
          to: [{ email: to }],
          subject: subject,
          htmlContent: html
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorData}`);
      }

      const data = await response.json();
      console.log('[Mailer] SUCCESS: Email sent via Brevo HTTP API. MessageId:', data.messageId);
    } catch (err) {
      console.error('[Mailer] FAILED via Brevo HTTP API:', err.message);
      console.log(`[Mailer Fallback] TO: ${to}, CONTENT: ${html}`);
    }
  }
};

console.log('[Mailer Config] Method: Brevo HTTP API, API_KEY:', process.env.BREVO_API_KEY ? 'SET' : 'MISSING');

module.exports = mailer;
