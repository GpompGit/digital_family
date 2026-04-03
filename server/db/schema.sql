-- =============================================================================
-- Digital Family — Database Schema
-- MariaDB 10.x / InnoDB / utf8mb4
-- =============================================================================
--
-- DATABASE BASICS FOR BEGINNERS:
--
-- A database stores data in TABLES (like spreadsheets). Each table has:
--   COLUMNS (fields) — define what data is stored (name, email, date, etc.)
--   ROWS (records) — each row is one entry (one user, one document, etc.)
--
-- KEY CONCEPTS USED IN THIS SCHEMA:
--
-- PRIMARY KEY: A unique identifier for each row. Usually an auto-incrementing
--   integer (id). No two rows can have the same primary key.
--
-- FOREIGN KEY (FK): A column that references the primary key of ANOTHER table.
--   This creates a RELATIONSHIP between tables. For example, documents.user_id
--   references users.id — connecting each document to who uploaded it.
--
-- ON DELETE CASCADE: When the referenced row is deleted, delete this row too.
--   Example: If a user is deleted, all their documents are deleted.
--
-- ON DELETE SET NULL: When the referenced row is deleted, set this column to NULL.
--   Example: If an institution is deleted, documents keep existing but lose
--   the institution link (institution_id becomes NULL).
--
-- UNIQUE: No two rows can have the same value in this column.
--   Example: No two users can have the same email.
--
-- INDEX: A data structure that speeds up searches on a column, like a book's
--   index. Without an index, the database scans every row (slow!).
--   With an index, it jumps directly to matching rows (fast!).
--
-- FULLTEXT INDEX: A special index for searching within text content.
--   Supports natural language search (like Google) instead of just exact matches.
--
-- ENGINE=InnoDB: The storage engine. InnoDB supports transactions and foreign keys.
-- CHARSET=utf8mb4: Full Unicode support (including emojis, Chinese, Arabic, etc.)
-- COLLATE=utf8mb4_unicode_ci: Case-insensitive text comparison.
--
-- TABLE CREATION ORDER MATTERS because of foreign keys:
--   Group A: Independent tables (no foreign keys pointing to other tables)
--   Group B: Tables that reference Group A tables
--   Group C: Tables that reference Group B tables
-- =============================================================================


-- ============================================================
-- Group A: Tables with no foreign key dependencies
-- ============================================================

-- USERS — Family members and pets.
-- Both humans (who can log in) and pets (who can own documents but can't log in).
-- The admin creates all users; there is no self-registration.
-- email is nullable because pets don't have email addresses.
-- password_hash stores a bcrypt hash, NEVER the plain-text password.
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) DEFAULT NULL UNIQUE, -- NULL for pets (can't log in)
  password_hash VARCHAR(255) DEFAULT NULL, -- bcrypt hash; NULL for pets
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) DEFAULT NULL,        -- NULL for pets (they only have a first name)
  role ENUM('admin','member') NOT NULL DEFAULT 'member', -- admin can manage settings
  can_login BOOLEAN NOT NULL DEFAULT FALSE, -- FALSE for pets, TRUE for human family members
  birth_date DATE DEFAULT NULL,            -- date of birth (humans and pets)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- CATEGORIES — Document types (insurance, contracts, vaccines, etc.)
-- A document belongs to exactly ONE category.
-- "slug" is a URL-safe version of the name: "ID Documents" → "id-documents"
CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- INSTITUTIONS — Organizations that issue documents (hospitals, schools, etc.)
-- Normalized table prevents typos ("Dr. Müller" vs "Dr. Mueller").
-- A document can optionally belong to one institution.
CREATE TABLE IF NOT EXISTS institutions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  slug VARCHAR(255) NOT NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- TAGS — Flexible labels for cross-cutting concerns.
-- Unlike categories (one per document), a document can have MANY tags.
-- Examples: "Urgent", "Tax Relevant", "Pet", "Expiring Soon"
-- color is a hex value for visual distinction in the UI.
CREATE TABLE IF NOT EXISTS tags (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  color CHAR(7) NOT NULL DEFAULT '#6B7280', -- hex color, e.g. '#EF4444' for red
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- CUSTOM FIELD DEFINITIONS — User-defined metadata fields.
-- This is the EAV (Entity-Attribute-Value) pattern: instead of adding a new
-- column to the documents table for every possible field, we define fields
-- dynamically and store values in a separate table (document_custom_fields).
-- Examples: "Policy Number" (string), "Contract End Date" (date), "Amount" (monetary)
CREATE TABLE IF NOT EXISTS custom_field_definitions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  data_type ENUM('string','date','integer','boolean','monetary','url') NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- SESSIONS — Stores user login sessions in the database.
-- Managed by express-mysql-session (we don't write to this table directly).
-- When a user logs in, a session row is created with their userId.
-- The session_id is sent to the browser as a cookie.
CREATE TABLE IF NOT EXISTS sessions (
  session_id VARCHAR(128) NOT NULL PRIMARY KEY, -- the cookie value
  expires INT UNSIGNED NOT NULL,   -- Unix timestamp when the session expires
  data MEDIUMTEXT,                 -- JSON with session data (e.g., { userId: 1 })
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- PASSWORD_RESET_TOKENS — One-time tokens for password reset via email.
-- Flow: user requests reset → token generated → email sent → user clicks link → token verified → password changed.
-- Tokens expire after 15 minutes and are single-use (used = TRUE after verification).
-- We don't delete used/expired tokens immediately — a cleanup job handles that.
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token CHAR(64) NOT NULL UNIQUE,           -- crypto.randomBytes(32).toString('hex')
  used BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at DATETIME NOT NULL,             -- NOW() + 15 minutes
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ASSETS — Physical items owned by the family: cars, houses, boats, appliances, etc.
-- Unlike users (people/pets), assets are THINGS that can have documents associated
-- with them (insurance, maintenance, titles, drawings, receipts).
-- Every asset has an owner (a family member from the users table).
-- A document can belong to BOTH a person AND an asset — e.g., car insurance
-- belongs to the car (asset) AND the policyholder (person).
CREATE TABLE IF NOT EXISTS assets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,                    -- "Volvo XC60", "Apartment Zürich", "Sailboat Luna"
  slug VARCHAR(255) NOT NULL UNIQUE,             -- URL-safe: "volvo-xc60"
  asset_type ENUM('car','house','boat','appliance','other') NOT NULL,
  owner_id INT NOT NULL,                         -- FK → users.id (which family member owns this)
  notes TEXT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ASSET_ATTRIBUTES — Flexible key-value attributes for assets.
-- EAV pattern so any asset type can have any attributes without schema changes.
-- Examples: car → brand:Volvo, model:XC60, year:2021, license_plate:ZH 123456
--           house → address:Musterstr. 42, purchase_year:2018
CREATE TABLE IF NOT EXISTS asset_attributes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  asset_id INT NOT NULL,
  attribute_name VARCHAR(100) NOT NULL,
  attribute_value VARCHAR(500) NOT NULL,
  UNIQUE KEY uq_asset_attr (asset_id, attribute_name),
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- USER_ATTRIBUTES — Flexible key-value attributes for persons and pets.
-- People: date_of_birth, phone. Pets: date_of_birth, color, breed, microchip.
CREATE TABLE IF NOT EXISTS user_attributes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  attribute_name VARCHAR(100) NOT NULL,
  attribute_value VARCHAR(500) NOT NULL,
  UNIQUE KEY uq_user_attr (user_id, attribute_name),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- USER_ADDRESSES — Physical addresses with move-in/move-out history.
-- A person can have multiple addresses (current + historical).
-- year_in/year_out track when they lived/live there.
-- year_out = NULL means they currently live there.
CREATE TABLE IF NOT EXISTS user_addresses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  label VARCHAR(50) NOT NULL DEFAULT 'home',       -- 'home', 'work', 'vacation', etc.
  street VARCHAR(255) NOT NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100) DEFAULT NULL,                  -- canton, province, state
  zip VARCHAR(20) DEFAULT NULL,
  country VARCHAR(100) NOT NULL DEFAULT 'Switzerland',
  year_in SMALLINT UNSIGNED DEFAULT NULL,           -- year moved in (e.g., 2018)
  year_out SMALLINT UNSIGNED DEFAULT NULL,          -- year moved out (NULL = current)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- USER_CONTACTS — Multiple email addresses and phone numbers per person.
-- Each contact has a type (email/phone) and a label (personal/work/etc).
CREATE TABLE IF NOT EXISTS user_contacts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  contact_type ENUM('email','phone','mobile') NOT NULL,
  label VARCHAR(50) NOT NULL DEFAULT 'personal',   -- 'personal', 'work', 'emergency', etc.
  value VARCHAR(255) NOT NULL,                      -- the email address or phone number
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,        -- one primary per type
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- USER_IDENTITY_DOCS — Passports, ID cards, driver licenses, etc.
-- Each identity document has a number, validity dates, and issuing country.
-- A person can have multiple (e.g., passport + ID card + driver license).
CREATE TABLE IF NOT EXISTS user_identity_docs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  doc_type ENUM('passport','id_card','driver_license','residence_permit','other') NOT NULL,
  doc_number VARCHAR(100) NOT NULL,
  issuing_country VARCHAR(100) DEFAULT NULL,
  issue_date DATE DEFAULT NULL,
  expire_date DATE DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- Group B: Tables depending on Group A
-- ============================================================

-- DOCUMENTS — The core table. Each row represents one uploaded PDF.
--
-- Two user references:
--   user_id    = who UPLOADED the document (the uploader)
--   person_id  = who the document BELONGS TO (the subject — could be a pet!)
--   Example: Mom (user_id=1) uploads a vaccine record for the cat (person_id=5)
--
-- File storage:
--   file_path = relative path on disk, e.g. "doe-john/insurance_2024-03-15_..._a1b2.pdf"
--   uuid = public identifier used in URLs (not the database ID, for security)
--
-- Versioning:
--   version = version number (starts at 1)
--   parent_uuid = points to the original document when this is a newer version
--   To find the latest version: SELECT * WHERE parent_uuid = ? ORDER BY version DESC LIMIT 1
--
-- Expiry tracking:
--   expires_at = when the document expires (e.g., insurance policy end date)
--   reminder_sent = prevents sending the same reminder email twice
--
-- ON DELETE behavior:
--   user/person deleted → CASCADE (delete their documents too)
--   category deleted → RESTRICT (can't delete a category with documents)
--   institution deleted → SET NULL (documents keep existing, lose institution link)
--   parent document deleted → SET NULL (versions become standalone)
CREATE TABLE IF NOT EXISTS documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid CHAR(36) NOT NULL UNIQUE,           -- public identifier (e.g., in URLs)
  user_id INT NOT NULL,                     -- FK: who uploaded this
  person_id INT NOT NULL,                   -- FK: who this document belongs to
  category_id INT NOT NULL,                 -- FK: document type (insurance, vaccine, etc.)
  institution_id INT DEFAULT NULL,          -- FK: issuing institution (optional)
  asset_id INT DEFAULT NULL,               -- FK: related asset (car, house, etc.) — optional
  title VARCHAR(255) NOT NULL,              -- user-provided title
  document_date DATE DEFAULT NULL,          -- the date ON the document
  file_path VARCHAR(500) NOT NULL,          -- relative path under uploads/
  file_size INT NOT NULL,                   -- file size in bytes
  original_filename VARCHAR(255) NOT NULL,  -- the filename the user uploaded (for downloads)
  notes TEXT DEFAULT NULL,                  -- optional user notes
  extracted_text MEDIUMTEXT DEFAULT NULL,   -- OCR text content (future feature)
  expires_at DATE DEFAULT NULL,             -- document expiry date (for reminders)
  reminder_sent BOOLEAN NOT NULL DEFAULT FALSE, -- has expiry reminder been sent?
  is_encrypted BOOLEAN NOT NULL DEFAULT FALSE, -- file + metadata encrypted at rest (AES-256-GCM)
  encryption_iv CHAR(32) DEFAULT NULL,        -- hex-encoded IV for decryption (unique per document)
  is_private BOOLEAN NOT NULL DEFAULT FALSE,  -- visible ONLY to person_id (not even admin)
  version INT NOT NULL DEFAULT 1,           -- version number for versioned documents
  parent_uuid CHAR(36) DEFAULT NULL,        -- FK: original document UUID (for versions)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (person_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE SET NULL,
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE SET NULL,
  FOREIGN KEY (parent_uuid) REFERENCES documents(uuid) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- AUDIT LOG — Records every significant action in the system.
-- Used for security monitoring and accountability.
-- user_id is SET NULL on delete so audit records survive user deletion
-- (we don't lose the history when a user is removed).
-- details is a JSON column for flexible extra context.
-- ip_address supports IPv6 (up to 45 characters).
CREATE TABLE IF NOT EXISTS audit_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT DEFAULT NULL,                 -- who did it (NULL for unauthenticated actions)
  action ENUM('create','update','delete','login','logout','download') NOT NULL,
  entity_type VARCHAR(50) NOT NULL,         -- what type: 'document', 'user', 'session', etc.
  entity_id INT DEFAULT NULL,               -- database ID of the affected entity
  entity_uuid CHAR(36) DEFAULT NULL,        -- UUID of the entity (for documents)
  details JSON DEFAULT NULL,                -- extra context as JSON
  ip_address VARCHAR(45) NOT NULL,          -- client IP (supports IPv6)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- Group C: Junction and child tables
-- ============================================================

-- DOCUMENT_TAGS — Many-to-many relationship between documents and tags.
-- A "junction table" (or "bridge table") connects two tables that have a
-- many-to-many relationship: one document can have many tags, and one tag
-- can be on many documents.
-- The composite primary key (document_id, tag_id) prevents duplicate tag assignments.
-- CASCADE on both sides: deleting a document or tag removes the link.
CREATE TABLE IF NOT EXISTS document_tags (
  document_id INT NOT NULL,
  tag_id INT NOT NULL,
  PRIMARY KEY (document_id, tag_id),  -- composite PK: one tag per document (no duplicates)
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- DOCUMENT_CUSTOM_FIELDS — Stores custom metadata values for documents.
-- Uses the EAV (Entity-Attribute-Value) pattern with typed value columns.
-- Only ONE value column is used per row, based on the field's data_type:
--   data_type='string' → value_string
--   data_type='date' → value_date
--   data_type='monetary' → value_decimal
--   etc.
-- UNIQUE KEY prevents setting the same custom field twice on one document.
CREATE TABLE IF NOT EXISTS document_custom_fields (
  id INT AUTO_INCREMENT PRIMARY KEY,
  document_id INT NOT NULL,
  field_id INT NOT NULL,
  value_string VARCHAR(500) DEFAULT NULL,   -- for 'string' and 'url' types
  value_date DATE DEFAULT NULL,             -- for 'date' type
  value_integer INT DEFAULT NULL,           -- for 'integer' type
  value_boolean BOOLEAN DEFAULT NULL,       -- for 'boolean' type
  value_decimal DECIMAL(12,2) DEFAULT NULL, -- for 'monetary' type (12 digits, 2 decimal places)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_doc_field (document_id, field_id), -- one value per field per document
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (field_id) REFERENCES custom_field_definitions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- MATCHING RULES — Auto-tagging rules based on document content (future feature).
-- When OCR extracts text from a PDF, these rules check if patterns match
-- and automatically assign tags, categories, or institutions.
-- This is a "polymorphic association": entity_id references different tables
-- depending on entity_type (tags, categories, or institutions).
-- We don't use a formal FK here because it would need to point to 3 tables.
CREATE TABLE IF NOT EXISTS matching_rules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  entity_type ENUM('tag','category','institution') NOT NULL, -- which table entity_id refers to
  entity_id INT NOT NULL,                   -- ID in the referenced table (polymorphic)
  match_pattern VARCHAR(500) NOT NULL,      -- text pattern to match against
  matching_algorithm ENUM('exact','any_word','all_words','regex','fuzzy') NOT NULL DEFAULT 'any_word',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,  -- can be temporarily disabled
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- Indexes — Speed up frequent queries
-- ============================================================
--
-- WHY INDEXES?
-- Without an index, a query like "find all documents for person_id = 3"
-- would scan EVERY row in the table (called a "full table scan").
-- An index is like a phone book: sorted by the indexed column, allowing
-- the database to jump directly to matching rows.
--
-- RULE OF THUMB: Create indexes on columns used in:
--   - WHERE clauses (filtering)
--   - JOIN conditions (connecting tables)
--   - ORDER BY clauses (sorting)
--
-- DON'T over-index: each index slows down INSERT/UPDATE operations because
-- the index must be updated too. Only index columns you actually query on.
-- ============================================================

-- Documents: we filter/sort by all of these columns frequently
CREATE INDEX idx_documents_category ON documents(category_id);
CREATE INDEX idx_documents_user ON documents(user_id);
CREATE INDEX idx_documents_person ON documents(person_id);
CREATE INDEX idx_documents_date ON documents(document_date);
CREATE INDEX idx_documents_institution ON documents(institution_id);
CREATE INDEX idx_documents_asset ON documents(asset_id);
CREATE INDEX idx_documents_expires ON documents(expires_at);
CREATE INDEX idx_documents_parent_uuid ON documents(parent_uuid);
-- Composite index: find latest version of a document efficiently
CREATE INDEX idx_documents_version ON documents(parent_uuid, version);

-- FULLTEXT index: enables natural language search across document titles and OCR text.
-- MariaDB InnoDB supports FULLTEXT indexes from version 10.0.15+.
-- Usage: SELECT * FROM documents WHERE MATCH(title, extracted_text) AGAINST('search terms' IN BOOLEAN MODE)
ALTER TABLE documents ADD FULLTEXT INDEX ft_documents_search (title, extracted_text);

-- Audit log: filter by entity, user, or date
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_uuid);
CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_created ON audit_log(created_at);

-- Document tags: the composite PK already covers lookups by document_id.
-- This additional index supports "find all documents with tag X" (lookup by tag_id).
CREATE INDEX idx_document_tags_tag ON document_tags(tag_id);

-- Custom fields: support lookups by document and by field definition
CREATE INDEX idx_custom_fields_document ON document_custom_fields(document_id);
CREATE INDEX idx_custom_fields_field ON document_custom_fields(field_id);

-- User personal data
CREATE INDEX idx_user_addresses_user ON user_addresses(user_id);
CREATE INDEX idx_user_contacts_user ON user_contacts(user_id);
CREATE INDEX idx_user_identity_docs_user ON user_identity_docs(user_id);

-- Matching rules: find active rules for a specific entity type
CREATE INDEX idx_matching_rules_entity ON matching_rules(entity_type, entity_id);
CREATE INDEX idx_matching_rules_active ON matching_rules(is_active);
