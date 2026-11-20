import nodemailer from 'nodemailer';

export async function sendRecoveryEmail(
  toEmail: string,
  recoveryToken: string,
): Promise<boolean> {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  const recoveryUrl = `${process.env.APP_URL || 'http://localhost:3000'}?token=${encodeURIComponent(recoveryToken)}&email=${encodeURIComponent(toEmail)}`;

  if (!host || !user || !pass) {
    console.log('====================================================');
    console.log('[CoSec Vault Account Recovery]');
    console.log(`To: ${toEmail}`);
    console.log(`Recovery Token: ${recoveryToken}`);
    console.log(`Direct Recovery Link: ${recoveryUrl}`);
    console.log('====================================================');
    return true;
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from: `"CoSec Vault Security" <${user}>`,
      to: toEmail,
      subject: 'Password Recovery Request - CoSec Vault',
      text: `You requested a password reset for your CoSec Vault account.\n\nYour recovery token is: ${recoveryToken}\n\nOr click here to reset your password: ${recoveryUrl}\n\nThis token expires in 30 minutes. If you did not request this, please ignore this email.`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h2 style="color: #0f172a; margin-top: 0;">CoSec Vault Account Recovery</h2>
          <p style="color: #334155; font-size: 14px;">You requested a password reset for your CoSec Vault account.</p>
          <div style="background: #f8fafc; border: 1px solid #cbd5e1; padding: 12px 16px; font-family: monospace; font-size: 16px; font-weight: bold; border-radius: 6px; margin: 16px 0; text-align: center; color: #0f172a;">
            ${recoveryToken}
          </div>
          <p style="color: #334155; font-size: 14px;">Or click the button below to reset your password:</p>
          <p style="margin: 20px 0;">
            <a href="${recoveryUrl}" style="background: #0f172a; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">Reset Password</a>
          </p>
          <p style="color: #64748b; font-size: 12px; margin-top: 24px;">This recovery token expires in 30 minutes. If you did not request this, please disregard this email.</p>
        </div>
      `,
    });
    return true;
  } catch (err) {
    console.error('Failed to send recovery email via SMTP:', err);
    return false;
  }
}
