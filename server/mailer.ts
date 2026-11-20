import nodemailer from 'nodemailer';
import type { RegistryUser } from './registry.ts';
import type { CompanyAssignment, StatutoryDocument } from '../src/types.ts';

function formatMalaysiaTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return (
      new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kuala_Lumpur',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).format(date) + ' MYT'
    );
  } catch {
    return isoString;
  }
}

function getTransporter() {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  }
  return null;
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
}) {
  const recipientList = Array.isArray(to) ? to.join(', ') : to;
  const transporter = getTransporter();

  if (transporter) {
    try {
      const fromEmail =
        process.env.SMTP_FROM?.trim() ||
        process.env.SMTP_USER?.trim() ||
        'noreply@cosecvault.my';
      await transporter.sendMail({
        from: `"CoSec Vault Portal" <${fromEmail}>`,
        to: recipientList,
        subject,
        html,
        text,
      });
      console.log(
        `[CoSec Vault Mailer] Sent email via SMTP to [${recipientList}] | Subject: ${subject}`,
      );
      return true;
    } catch (err) {
      console.error(
        `[CoSec Vault Mailer] SMTP send error to [${recipientList}]:`,
        err,
      );
    }
  }

  // Fallback console log when SMTP is not configured
  console.log(`\n================== [MAILER CONSOLE FALLBACK] ==================`);
  console.log(`To: ${recipientList}`);
  console.log(`Subject: ${subject}`);
  console.log(`---------------------------------------------------------------`);
  console.log(text);
  console.log(`===============================================================\n`);
  return true;
}

export async function sendRegistrationEmails(
  newUser: RegistryUser,
  admins: RegistryUser[],
  companyName: string,
  myCoId: string,
) {
  const userSubject = `Registration Received - ${companyName} (${myCoId}) | CoSec Vault`;
  const userHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #0f172a; margin-top: 0;">Registration Received</h2>
      <p>Dear <strong>${newUser.fullName}</strong>,</p>
      <p>Thank you for registering with CoSec Vault. Your account registration for <strong>${companyName}</strong> (SSM No: <strong>${myCoId}</strong>) has been successfully received.</p>
      <p>Our Company Secretary department is reviewing your registration. You will receive an email confirmation as soon as your account is activated.</p>
      <br/>
      <p style="color: #64748b; font-size: 13px;">Best regards,<br/><strong>CoSec Vault Secretarial Team</strong></p>
    </div>
  `;
  const userText = `Dear ${newUser.fullName},\n\nThank you for registering with CoSec Vault. Your account registration for ${companyName} (SSM No: ${myCoId}) has been successfully received and is pending verification by our Company Secretary department.\n\nBest regards,\nCoSec Vault Secretarial Team`;

  await sendEmail({
    to: newUser.email,
    subject: userSubject,
    html: userHtml,
    text: userText,
  });

  const adminEmails = admins
    .filter((a) => a.status === 'active' && (a.role === 'administrator' || a.role === 'manager'))
    .map((a) => a.email);
  if (adminEmails.length > 0) {
    const adminSubject = `[Action Required] New User Registration: ${companyName} (${myCoId})`;
    const adminHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
        <h2 style="color: #0f172a; margin-top: 0;">New User Registration Pending Approval</h2>
        <p>A new user has registered on CoSec Vault and awaits verification:</p>
        <ul>
          <li><strong>Full Name:</strong> ${newUser.fullName}</li>
          <li><strong>Email:</strong> ${newUser.email}</li>
          <li><strong>Company Name:</strong> ${companyName}</li>
          <li><strong>SSM MyCoID:</strong> ${myCoId}</li>
        </ul>
        <p>Please log in to the CoSec Vault portal under <strong>Access Rights & Users</strong> to review and activate this account.</p>
      </div>
    `;
    const adminText = `New user registration pending approval:\n\nName: ${newUser.fullName}\nEmail: ${newUser.email}\nCompany: ${companyName} (${myCoId})\n\nPlease log in to approve this account.`;

    await sendEmail({
      to: adminEmails,
      subject: adminSubject,
      html: adminHtml,
      text: adminText,
    });
  }
}

export async function sendAccountApprovedEmail(user: RegistryUser) {
  const subject = `Account Approved & Activated - CoSec Vault`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #0f172a; margin-top: 0;">Welcome to CoSec Vault!</h2>
      <p>Dear <strong>${user.fullName}</strong>,</p>
      <p>Your CoSec Vault account has been verified and activated by our Company Secretary department.</p>
      <p>You can now sign in to securely access your statutory records, resolutions, and corporate vault documents.</p>
      <br/>
      <p style="color: #64748b; font-size: 13px;">Best regards,<br/><strong>CoSec Vault Secretarial Team</strong></p>
    </div>
  `;
  const text = `Dear ${user.fullName},\n\nYour CoSec Vault account has been verified and activated. You can now sign in to securely access your corporate vault documents.\n\nBest regards,\nCoSec Vault Secretarial Team`;

  await sendEmail({
    to: user.email,
    subject,
    html,
    text,
  });
}

export async function sendNewDocumentUploadedEmails(
  company: CompanyAssignment,
  document: StatutoryDocument,
  allUsers: RegistryUser[],
  uploadedBy: string,
): Promise<number> {
  const activeUsersForCompany = allUsers.filter(
    (u) =>
      u.status === 'active' &&
      Array.isArray(u.companies) &&
      u.companies.some((c) => c.myCoId === company.myCoId),
  );

  const recipientEmails = activeUsersForCompany.map((u) => u.email);
  if (recipientEmails.length === 0) return 0;

  const uploadTime = formatMalaysiaTime(document.lastUpdated);
  const subject = `New Statutory Form Uploaded: ${document.fileName} - ${company.companyName} (${company.myCoId})`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #0f172a; margin-top: 0;">New Statutory Document Available</h2>
      <p>A new statutory document has been uploaded to your company vault:</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Company:</td>
          <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">${company.companyName} (${company.myCoId})</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Document Name:</td>
          <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; font-weight: bold; color: #2563eb;">${document.fileName}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Category:</td>
          <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${document.category} (${document.statutorySection})</td>
        </tr>
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e2e8f0; color: #64748b;">Uploaded At:</td>
          <td style="padding: 8px; border-bottom: 1px solid #e2e8f0;">${uploadTime}</td>
        </tr>
        <tr>
          <td style="padding: 8px; color: #64748b;">Uploaded By:</td>
          <td style="padding: 8px;">${uploadedBy}</td>
        </tr>
      </table>
      <p>Please sign in to your CoSec Vault portal to view and download this document.</p>
      <br/>
      <p style="color: #64748b; font-size: 13px;">Best regards,<br/><strong>CoSec Vault Secretarial Team</strong></p>
    </div>
  `;
  const text = `New Statutory Document Available for ${company.companyName} (${company.myCoId}):\n\nDocument: ${document.fileName}\nCategory: ${document.category} (${document.statutorySection})\nUploaded At: ${uploadTime}\n\nPlease sign in to CoSec Vault to download this document.`;

  await sendEmail({
    to: recipientEmails,
    subject,
    html,
    text,
  });

  return recipientEmails.length;
}

export async function sendRecoveryEmail(toEmail: string, recoveryToken: string) {
  const subject = `Password Reset Request - CoSec Vault`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
      <h2 style="color: #0f172a; margin-top: 0;">Password Reset Request</h2>
      <p>We received a request to reset the password for your CoSec Vault account (${toEmail}).</p>
      <p>If you did not request this, please ignore this email.</p>
      <p>Your password reset token is: <strong>${recoveryToken}</strong></p>
      <br/>
      <p style="color: #64748b; font-size: 13px;">Best regards,<br/><strong>CoSec Vault Secretarial Team</strong></p>
    </div>
  `;
  const text = `Password Reset Request for CoSec Vault (${toEmail}).\n\nYour reset token is: ${recoveryToken}`;

  await sendEmail({
    to: toEmail,
    subject,
    html,
    text,
  });
}

