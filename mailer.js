import { config } from './config.js';
export async function sendPaidOrderEmail(to, title, downloadUrl) {
  if (!config.smtpHost || !config.smtpUser || !config.smtpPassword) return false;
  const nodemailer = await import('nodemailer');
  const transporter = nodemailer.createTransport({
    host: config.smtpHost, port: config.smtpPort, secure: config.smtpSecure,
    auth: { user: config.smtpUser, pass: config.smtpPassword }
  });
  await transporter.sendMail({
    from: config.mailFrom, to,
    subject: `Your smoker.entry.web e-book: ${title}`,
    text: `Your payment has been verified. Download your e-book here (link expires): ${downloadUrl}`,
    html: `<p>Your payment has been verified.</p><p><a href="${downloadUrl}">Download your e-book</a></p><p>This link expires and has a limited number of downloads.</p>`
  });
  return true;
}
