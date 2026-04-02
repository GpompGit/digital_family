import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

export async function sendMagicLink(email, token) {
  const baseUrl = process.env.NODE_ENV === 'production'
    ? 'https://digitalfamily.carbonnull.ch'
    : `http://localhost:${process.env.PORT || 3456}`;

  const link = `${baseUrl}/auth/verify?token=${token}`;

  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'noreply@carbonnull.ch',
    to: email,
    subject: 'Digital Family - Login Link',
    html: `
      <h2>Digital Family Login</h2>
      <p>Click the link below to log in. This link expires in 15 minutes.</p>
      <p><a href="${link}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">Log In</a></p>
      <p>Or copy this URL: ${link}</p>
      <p><small>If you didn't request this, ignore this email.</small></p>
    `
  });
}
