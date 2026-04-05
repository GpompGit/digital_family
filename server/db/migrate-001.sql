-- =============================================================================
-- Migration: Add columns and tables introduced after initial deployment
-- =============================================================================
-- Run this on an existing database that was created from an earlier schema.sql.
-- All statements use IF NOT EXISTS / IF NOT EXISTS patterns so it's safe to
-- run multiple times (idempotent).
--
-- To run on the NAS:
--   docker-compose exec db mysql -u digital_family -p digital_family < server/db/migrate-001.sql
-- =============================================================================

-- 1. Add birth_date to users (if missing)
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'birth_date');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE users ADD COLUMN birth_date DATE DEFAULT NULL AFTER can_login', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 2. Add asset_id to documents (if missing)
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'documents' AND COLUMN_NAME = 'asset_id');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE documents ADD COLUMN asset_id INT DEFAULT NULL AFTER institution_id', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 3. Add is_encrypted, encryption_iv, is_private to documents (if missing)
SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'documents' AND COLUMN_NAME = 'is_encrypted');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE documents ADD COLUMN is_encrypted BOOLEAN NOT NULL DEFAULT FALSE AFTER parent_uuid', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'documents' AND COLUMN_NAME = 'encryption_iv');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE documents ADD COLUMN encryption_iv CHAR(32) DEFAULT NULL AFTER is_encrypted', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @col_exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'documents' AND COLUMN_NAME = 'is_private');
SET @sql = IF(@col_exists = 0, 'ALTER TABLE documents ADD COLUMN is_private BOOLEAN NOT NULL DEFAULT FALSE AFTER encryption_iv', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 4. Assets table
CREATE TABLE IF NOT EXISTS assets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  asset_type ENUM('car','house','boat','appliance','other') NOT NULL,
  owner_id INT NOT NULL,
  notes TEXT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Asset attributes (EAV)
CREATE TABLE IF NOT EXISTS asset_attributes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  asset_id INT NOT NULL,
  attribute_name VARCHAR(100) NOT NULL,
  attribute_value VARCHAR(500) NOT NULL,
  UNIQUE KEY uq_asset_attr (asset_id, attribute_name),
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. User attributes (EAV for person/pet metadata)
CREATE TABLE IF NOT EXISTS user_attributes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  attribute_name VARCHAR(100) NOT NULL,
  attribute_value VARCHAR(500) NOT NULL,
  UNIQUE KEY uq_user_attr (user_id, attribute_name),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. User addresses
CREATE TABLE IF NOT EXISTS user_addresses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  label VARCHAR(50) NOT NULL DEFAULT 'home',
  street VARCHAR(255) NOT NULL,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(100) DEFAULT NULL,
  zip VARCHAR(20) DEFAULT NULL,
  country VARCHAR(100) NOT NULL DEFAULT 'Switzerland',
  year_in SMALLINT UNSIGNED DEFAULT NULL,
  year_out SMALLINT UNSIGNED DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. User contacts (multiple emails, phones)
CREATE TABLE IF NOT EXISTS user_contacts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  contact_type ENUM('email','phone','mobile') NOT NULL,
  label VARCHAR(50) NOT NULL DEFAULT 'personal',
  value VARCHAR(255) NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. User identity documents (passports, IDs, driver licenses)
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

-- 10. Password reset tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token CHAR(64) NOT NULL UNIQUE,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Add FK for asset_id on documents (if not exists)
-- Ignore error if FK already exists
SET @fk_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'documents' AND CONSTRAINT_NAME = 'documents_ibfk_asset');
SET @sql = IF(@fk_exists = 0, 'ALTER TABLE documents ADD CONSTRAINT documents_ibfk_asset FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE SET NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 12. Add indexes for new tables
CREATE INDEX IF NOT EXISTS idx_user_addresses_user ON user_addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_user_contacts_user ON user_contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_identity_docs_user ON user_identity_docs(user_id);

-- 13. Seed new categories (if missing)
INSERT IGNORE INTO categories (name, slug) VALUES ('Invoices', 'invoices');

-- 14. Seed invoice custom field definitions
INSERT IGNORE INTO custom_field_definitions (name, slug, data_type) VALUES
  ('Invoice Number', 'invoice-number', 'string'),
  ('Amount', 'amount', 'monetary'),
  ('Currency', 'currency', 'string'),
  ('VAT', 'vat', 'monetary'),
  ('Paid Date', 'paid-date', 'date'),
  ('Payment Method', 'payment-method', 'string');

-- 15. Seed new tags
INSERT IGNORE INTO tags (name, slug, color) VALUES
  ('Paid', 'paid', '#10B981'),
  ('Unpaid', 'unpaid', '#EF4444'),
  ('Overdue', 'overdue', '#DC2626');

-- 16. Household account for family-wide documents
INSERT INTO users (email, password_hash, first_name, last_name, role, can_login)
SELECT NULL, NULL, 'Household', 'Account', 'member', FALSE
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM users WHERE first_name = 'Household' AND last_name = 'Account');

SELECT 'Migration complete!' AS status;
