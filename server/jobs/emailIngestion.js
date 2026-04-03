// =============================================================================
// emailIngestion.js — IMAP Email-to-Document Ingestion Job
// =============================================================================
//
// HOW IT WORKS:
// 1. Connects to a dedicated IMAP mailbox (e.g., docs@carbonnull.ch)
// 2. Polls for unread emails every N minutes
// 3. For each unread email:
//    a. Checks if the sender is a known family member (whitelist = users.email)
//    b. Extracts PDF attachments
//    c. Extracts text from PDFs (text layer, not image OCR)
//    d. Applies matching rules to auto-classify (category, tags, institution)
//    e. Stores the document (reusing the same flow as manual uploads)
//    f. Sends a confirmation email back to the sender
//    g. Marks the email as read
//
// WHY IMAP POLLING?
// - Works with any email provider (Gmail, Outlook, custom domain)
// - No DNS/MX changes needed
// - Runs inside the existing Node.js process (no extra Docker service)
// - Simple to implement and debug for low volume (5-20 emails/week)
//
// SECURITY:
// - Only processes emails from whitelisted senders (users.email)
// - Unknown senders are logged to audit trail and ignored
// - PDF files are validated (size limit, extension)
// - All operations logged to audit_log
// =============================================================================

import Imap from 'imap';
import { simpleParser } from 'mailparser';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import pool from '../db/connection.js';
import { buildDocumentPath, ensureDir, slugify } from '../utils/fileStorage.js';
import { extractTextFromPdf } from '../utils/pdfTextExtract.js';
import { applyMatchingRules } from '../utils/textMatcher.js';
import { logAudit } from '../utils/audit.js';
import { sendIngestionConfirmation } from '../utils/email.js';

// Maximum file size for ingested attachments (same as upload limit)
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '26214400');
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

/**
 * Start the IMAP polling loop. Called from app.js on startup.
 * Polls at the interval configured in IMAP_POLL_INTERVAL (default 2 min).
 */
export function startEmailIngestion() {
  const pollInterval = parseInt(process.env.IMAP_POLL_INTERVAL || '120000');

  console.log(`Email ingestion started (polling every ${pollInterval / 1000}s)`);

  // Run immediately on startup, then on interval
  processInbox().catch(err => console.error('Email ingestion error:', err.message));

  setInterval(() => {
    processInbox().catch(err => console.error('Email ingestion error:', err.message));
  }, pollInterval);
}

/**
 * Connect to the IMAP inbox, fetch unread emails, and process them.
 */
async function processInbox() {
  const imapConfig = {
    user: process.env.IMAP_USER,
    password: process.env.IMAP_PASS,
    host: process.env.IMAP_HOST,
    port: parseInt(process.env.IMAP_PORT || '993'),
    tls: true,
    tlsOptions: { rejectUnauthorized: false },
  };

  if (!imapConfig.user || !imapConfig.password || !imapConfig.host) {
    console.warn('Email ingestion: IMAP credentials not configured, skipping');
    return;
  }

  // Wrap IMAP operations in a promise since the imap library uses callbacks
  return new Promise((resolve, reject) => {
    const imap = new Imap(imapConfig);

    imap.once('ready', () => {
      imap.openBox('INBOX', false, async (err) => {
        if (err) {
          imap.end();
          return reject(err);
        }

        try {
          await fetchUnreadEmails(imap);
        } catch (e) {
          console.error('Error processing emails:', e.message);
        }

        imap.end();
        resolve();
      });
    });

    imap.once('error', (err) => {
      console.error('IMAP connection error:', err.message);
      resolve(); // don't reject — we'll retry on next poll
    });

    imap.once('end', () => {
      // Connection closed
    });

    imap.connect();
  });
}

/**
 * Fetch and process all unread emails in the inbox.
 */
async function fetchUnreadEmails(imap) {
  return new Promise((resolve, reject) => {
    imap.search(['UNSEEN'], async (err, uids) => {
      if (err) return reject(err);
      if (!uids || uids.length === 0) return resolve();

      console.log(`Email ingestion: found ${uids.length} unread email(s)`);

      // Process each email sequentially to avoid overwhelming the system
      for (const uid of uids) {
        try {
          await processOneEmail(imap, uid);
        } catch (e) {
          console.error(`Error processing email UID ${uid}:`, e.message);
        }
      }

      resolve();
    });
  });
}

/**
 * Process a single email: parse, validate sender, extract attachments, store documents.
 */
function processOneEmail(imap, uid) {
  return new Promise((resolve, reject) => {
    const fetch = imap.fetch([uid], { bodies: '', struct: true });

    fetch.on('message', (msg) => {
      let rawEmail = '';

      msg.on('body', (stream) => {
        stream.on('data', (chunk) => { rawEmail += chunk.toString('utf8'); });
      });

      msg.once('end', async () => {
        try {
          const parsed = await simpleParser(rawEmail);
          await handleParsedEmail(imap, uid, parsed);
          resolve();
        } catch (e) {
          console.error('Email parse error:', e.message);
          // Mark as read even on parse error to avoid infinite retry
          markAsRead(imap, uid);
          resolve();
        }
      });
    });

    fetch.once('error', (err) => {
      console.error('Fetch error:', err.message);
      resolve();
    });
  });
}

/**
 * Handle a parsed email: whitelist check, extract PDFs, store documents.
 */
async function handleParsedEmail(imap, uid, parsed) {
  // Extract sender email address
  const senderAddress = parsed.from?.value?.[0]?.address?.toLowerCase()?.trim();
  if (!senderAddress) {
    console.warn('Email ingestion: no sender address found');
    markAsRead(imap, uid);
    return;
  }

  // Whitelist check: look up sender in users table
  const [users] = await pool.query(
    'SELECT id, email, first_name, last_name FROM users WHERE email = ? AND can_login = TRUE',
    [senderAddress]
  );

  if (users.length === 0) {
    // Unknown sender — log and skip
    console.warn(`Email ingestion: unknown sender ${senderAddress}`);
    await logAudit(null, 'create', 'document', null, null, {
      source: 'email',
      reason: 'unknown_sender',
      sender: senderAddress,
      subject: parsed.subject
    }, '0.0.0.0');
    markAsRead(imap, uid);
    return;
  }

  const user = users[0];

  // Extract PDF attachments
  const pdfAttachments = (parsed.attachments || []).filter(att =>
    att.contentType === 'application/pdf' ||
    att.filename?.toLowerCase().endsWith('.pdf')
  );

  if (pdfAttachments.length === 0) {
    console.log(`Email ingestion: no PDF attachments from ${senderAddress}`);
    await logAudit(user.id, 'create', 'document', null, null, {
      source: 'email',
      reason: 'no_pdf_attachments',
      subject: parsed.subject
    }, '0.0.0.0');
    markAsRead(imap, uid);
    return;
  }

  // Clean up email subject for use as document title
  const emailSubject = cleanSubject(parsed.subject || 'Untitled Document');
  const emailDate = parsed.date ? formatDate(parsed.date) : null;

  // Process each PDF attachment
  const storedDocs = [];

  for (const attachment of pdfAttachments) {
    // Check file size
    if (attachment.size > MAX_FILE_SIZE) {
      console.warn(`Email ingestion: attachment ${attachment.filename} too large (${attachment.size} bytes)`);
      continue;
    }

    try {
      const doc = await storeAttachment(user, attachment, emailSubject, emailDate, pdfAttachments.length);
      storedDocs.push(doc);
    } catch (e) {
      console.error(`Email ingestion: failed to store ${attachment.filename}:`, e.message);
    }
  }

  if (storedDocs.length > 0) {
    // Send confirmation email to sender
    try {
      await sendIngestionConfirmation(user.email, storedDocs);
    } catch (e) {
      console.error('Email ingestion: failed to send confirmation:', e.message);
    }
  }

  // Mark email as read after successful processing
  markAsRead(imap, uid);
}

/**
 * Store a single PDF attachment as a document.
 * Reuses the same storage flow as manual uploads.
 */
async function storeAttachment(user, attachment, emailSubject, emailDate, attachmentCount) {
  const uuid = uuidv4();
  const originalFilename = attachment.filename || `document-${uuid.slice(0, 8)}.pdf`;

  // Use attachment filename as title if there are multiple attachments,
  // otherwise use the email subject
  const title = attachmentCount > 1
    ? originalFilename.replace(/\.pdf$/i, '')
    : emailSubject;

  // Save attachment to temp file
  const tempPath = `${UPLOAD_DIR}/${uuid}.pdf`;
  fs.writeFileSync(tempPath, attachment.content);

  // Extract text from PDF
  const extractedText = await extractTextFromPdf(tempPath);

  // Apply matching rules to auto-classify
  const searchText = `${title} ${extractedText || ''}`;
  const { categoryId, institutionId, tagIds } = await applyMatchingRules(searchText);

  // Look up the "Uncategorized" category as fallback
  let finalCategoryId = categoryId;
  if (!finalCategoryId) {
    const [[uncategorized]] = await pool.query(
      "SELECT id FROM categories WHERE slug = 'uncategorized'"
    );
    finalCategoryId = uncategorized?.id || 1; // absolute fallback to first category
  }

  // Look up category slug for file path
  const [[category]] = await pool.query('SELECT slug FROM categories WHERE id = ?', [finalCategoryId]);

  // Look up institution slug for file path (if matched)
  let institutionSlug = null;
  if (institutionId) {
    const [[inst]] = await pool.query('SELECT slug FROM institutions WHERE id = ?', [institutionId]);
    institutionSlug = inst?.slug || null;
  }

  // Build descriptive file path and move file
  const { relativePath, absolutePath, dirPath } = buildDocumentPath(
    user, category?.slug || 'uncategorized', emailDate, institutionSlug, title, uuid
  );
  ensureDir(dirPath);
  fs.renameSync(tempPath, absolutePath);

  // Insert document into database
  const [result] = await pool.query(
    `INSERT INTO documents (uuid, user_id, person_id, category_id, institution_id, title,
     document_date, file_path, file_size, original_filename, notes, extracted_text)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      uuid,
      user.id,              // uploader = the email sender
      user.id,              // person = the email sender (they forwarded it for themselves)
      finalCategoryId,
      institutionId || null,
      title,
      emailDate,
      relativePath,
      attachment.size,
      originalFilename,
      'Ingested via email',  // default note indicating source
      extractedText
    ]
  );

  const documentId = result.insertId;

  // Apply matched tags
  for (const tagId of tagIds) {
    await pool.query(
      'INSERT IGNORE INTO document_tags (document_id, tag_id) VALUES (?, ?)',
      [documentId, tagId]
    );
  }

  // Audit log
  await logAudit(user.id, 'create', 'document', documentId, uuid, {
    source: 'email',
    title,
    auto_category: finalCategoryId,
    auto_institution: institutionId,
    auto_tags: tagIds,
    extracted_text_length: extractedText?.length || 0
  }, '0.0.0.0');

  console.log(`Email ingestion: stored "${title}" (${uuid.slice(0, 8)}) for ${user.first_name}`);

  return {
    title,
    filename: originalFilename,
    uuid,
    categorySlug: category?.slug,
    institutionSlug
  };
}

// =============================================================================
// Helper functions
// =============================================================================

/**
 * Clean up an email subject for use as a document title.
 * Strips common forwarding prefixes: "Fwd:", "Re:", "FW:", "Fw:", etc.
 */
function cleanSubject(subject) {
  return subject
    .replace(/^(Fwd?|Re|FW|AW|WG)\s*:\s*/gi, '') // strip Fwd:, Re:, FW:, AW: (German), WG: (German)
    .replace(/^(Fwd?|Re|FW|AW|WG)\s*:\s*/gi, '') // strip again for "Fwd: Re: ..."
    .trim() || 'Untitled Document';
}

/**
 * Format a Date object as YYYY-MM-DD string for the database.
 */
function formatDate(date) {
  if (!date) return null;
  const d = new Date(date);
  return d.toISOString().split('T')[0]; // "2024-03-15"
}

/**
 * Mark an email as read in the IMAP inbox by adding the \Seen flag.
 */
function markAsRead(imap, uid) {
  try {
    imap.addFlags([uid], ['\\Seen'], (err) => {
      if (err) console.error('Failed to mark email as read:', err.message);
    });
  } catch (e) {
    console.error('markAsRead error:', e.message);
  }
}
