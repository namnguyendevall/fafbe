const transporter = require('../../config/mail');

const FROM_EMAIL = process.env.MAIL_USER || 'no-reply@faf-platform.com';

exports.sendContractSignedEmail = async ({ to, jobTitle, role, contractContent }) => {
    try {
        const mailOptions = {
            from: `"FAF Platform" <${FROM_EMAIL}>`,
            to,
            subject: `Contract Activated: ${jobTitle}`,
            html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                <div style="background-color: #0ea5e9; color: white; padding: 20px; text-align: center;">
                    <h2 style="margin: 0; font-size: 24px;">Contract Activated</h2>
                </div>
                <div style="padding: 30px; background-color: #f8fafc;">
                    <p style="font-size: 16px; color: #334155; line-height: 1.6;">
                        Hello,
                    </p>
                    <p style="font-size: 16px; color: #334155; line-height: 1.6;">
                        Both parties have officially signed the contract for the job: <strong>${jobTitle}</strong>. 
                        The contract is now <strong>ACTIVE</strong> and work can officially begin.
                    </p>
                    
                    <div style="margin: 25px 0; padding: 15px; background-color: #ecfdf5; border-left: 4px solid #10b981; border-radius: 4px;">
                        <p style="margin: 0; color: #065f46; font-size: 14px;">
                            <strong>Note:</strong> Escrow funds have been verified and securely locked for this contract. Both parties have cryptographically signed this agreement.
                        </p>
                    </div>

                    <div style="margin: 20px 0; padding: 20px; border: 1px solid #cbd5e1; border-radius: 6px; background-color: #ffffff; color: #334155; font-size: 14px; max-height: 500px; overflow-y: auto;">
                        <h3 style="margin-top: 0; color: #0ea5e9; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px;">Contract Agreement Details</h3>
                        <div style="line-height: 1.6;">
                            ${contractContent || '<p>Standard Freelance Agreement Terms Apply.</p>'}
                        </div>
                    </div>

                    <p style="font-size: 16px; color: #334155; line-height: 1.6;">
                        You can now access the Workspace to track checkpoints, upload deliverables, and communicate.
                    </p>
                </div>
                <div style="background-color: #f1f5f9; padding: 15px; text-align: center; color: #64748b; font-size: 12px;">
                    © ${new Date().getFullYear()} Freelance Audio/Video Platform (FAF). All rights reserved.
                </div>
            </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`Contract Signed Email sent to ${to}: ${info.messageId}`);
        return info;
    } catch (error) {
        console.error(`Error sending Contract Signed Email to ${to}:`, error);
        // Don't throw so we don't block the main flow if email fails
        return null; 
    }
};

exports.sendSystemNotificationEmail = async ({ to, subject, message }) => {
    try {
        const mailOptions = {
            from: `"FAF Platform" <${FROM_EMAIL}>`,
            to,
            subject: subject,
            html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                <div style="background-color: #3b82f6; color: white; padding: 20px; text-align: center;">
                    <h2 style="margin: 0; font-size: 20px;">${subject}</h2>
                </div>
                <div style="padding: 30px; background-color: #ffffff;">
                    <p style="font-size: 15px; color: #334155; line-height: 1.6; white-space: pre-wrap;">${message}</p>
                </div>
            </div>
            `
        };

        const info = await transporter.sendMail(mailOptions);
        return info;
    } catch (error) {
        console.error(`Error sending System Email to ${to}:`, error);
        return null;
    }
};
