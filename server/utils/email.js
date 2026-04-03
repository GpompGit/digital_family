// =============================================================================
// email.js — Email Sending Utilities (Nodemailer)
// =============================================================================
//
// Nodemailer is the standard Node.js library for sending emails via SMTP.
// SMTP (Simple Mail Transfer Protocol) is how email servers talk to each other.
//
// We configure a "transporter" — a reusable connection to the SMTP server —
// and use it to send emails. The SMTP credentials come from environment variables.
//
// USED FOR:
//   - Password reset emails (future)
//   - Expiry reminder emails (future)
//   - Email ingestion confirmation (when a forwarded email is processed)
// =============================================================================

import nodemailer from 'nodemailer';

// Create a reusable SMTP transporter.
// "secure: false" with port 587 means STARTTLS (upgrade to TLS after connecting).
// Port 465 would use "secure: true" (TLS from the start).
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

const fromAddress = process.env.SMTP_FROM || 'noreply@carbonnull.ch';
const baseUrl = process.env.NODE_ENV === 'production'
  ? 'https://digitalfamily.carbonnull.ch'
  : `http://localhost:${process.env.PORT || 3456}`;

/**
 * Send a confirmation email after documents are ingested from a forwarded email.
 * Lists each document that was stored, with its auto-assigned category.
 *
 * @param {string} email — recipient (the person who forwarded the email)
 * @param {{ title: string, filename: string, uuid: string, categorySlug: string|null, institutionSlug: string|null }[]} documents — list of stored documents
 */
export async function sendIngestionConfirmation(email, documents) {
  if (!email || !process.env.SMTP_HOST) return;

  const docList = documents.map(doc => {
    const category = doc.categorySlug || 'uncategorized';
    const institution = doc.institutionSlug ? ` / ${doc.institutionSlug}` : '';
    const link = `${baseUrl}/documents/${doc.uuid}`;
    return `<li><a href="${link}">${doc.title}</a> → ${category}${institution} <small>(${doc.filename})</small></li>`;
  }).join('\n');

  const count = documents.length;
  const subject = `Digital Family: ${count} document${count !== 1 ? 's' : ''} stored`;

  await transporter.sendMail({
    from: fromAddress,
    to: email,
    subject,
    html: `
      <h2>Digital Family</h2>
      <p>The following document${count !== 1 ? 's were' : ' was'} received and stored:</p>
      <ul>${docList}</ul>
      <p><a href="${baseUrl}" style="display:inline-block;padding:10px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">Open Digital Family</a></p>
      <p><small>You can edit metadata, change category, or add tags from the document detail page.</small></p>
    `
  });
}

/**
 * Send a password reset email with a one-time link.
 * (Placeholder — will be fully implemented in Sprint 1.5)
 *
 * @param {string} email — recipient
 * @param {string} token — the reset token
 */
export async function sendPasswordResetEmail(email, token) {
  if (!email || !process.env.SMTP_HOST) return;

  const link = `${baseUrl}/reset-password?token=${token}`;

  await transporter.sendMail({
    from: fromAddress,
    to: email,
    subject: 'Digital Family — Password Reset',
    html: `
      <h2>Digital Family</h2>
      <p>Click the link below to reset your password. This link expires in 15 minutes.</p>
      <p><a href="${link}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px;">Reset Password</a></p>
      <p>Or copy this URL: ${link}</p>
      <p><small>If you didn't request this, ignore this email.</small></p>
    `
  });
}
