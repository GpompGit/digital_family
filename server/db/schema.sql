-- Digital Family - Database Schema
-- MariaDB 10.x / InnoDB / utf8mb4

-- ============================================================
-- Group A: Tables with no foreign key dependencies
-- ============================================================

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) DEFAULT NULL UNIQUE,
  password_hash VARCHAR(255) DEFAULT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  role ENUM('admin','member') NOT NULL DEFAULT 'member',
  can_login BOOLEAN NOT NULL DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS institutions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  slug VARCHAR(255) NOT NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tags (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  color CHAR(7) NOT NULL DEFAULT '#6B7280',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS custom_field_definitions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  slug VARCHAR(100) NOT NULL UNIQUE,
  data_type ENUM('string','date','integer','boolean','monetary','url') NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
  session_id VARCHAR(128) NOT NULL PRIMARY KEY,
  expires INT UNSIGNED NOT NULL,
  data MEDIUMTEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Group B: Tables depending on Group A
-- ============================================================

CREATE TABLE IF NOT EXISTS documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  uuid CHAR(36) NOT NULL UNIQUE,
  user_id INT NOT NULL,
  person_id INT NOT NULL,
  category_id INT NOT NULL,
  institution_id INT DEFAULT NULL,
  title VARCHAR(255) NOT NULL,
  document_date DATE DEFAULT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size INT NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  notes TEXT DEFAULT NULL,
  extracted_text MEDIUMTEXT DEFAULT NULL,
  expires_at DATE DEFAULT NULL,
  reminder_sent BOOLEAN NOT NULL DEFAULT FALSE,
  version INT NOT NULL DEFAULT 1,
  parent_uuid CHAR(36) DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (person_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id),
  FOREIGN KEY (institution_id) REFERENCES institutions(id) ON DELETE SET NULL,
  FOREIGN KEY (parent_uuid) REFERENCES documents(uuid) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT DEFAULT NULL,
  action ENUM('create','update','delete','login','logout','download') NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INT DEFAULT NULL,
  entity_uuid CHAR(36) DEFAULT NULL,
  details JSON DEFAULT NULL,
  ip_address VARCHAR(45) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Group C: Junction and child tables
-- ============================================================

CREATE TABLE IF NOT EXISTS document_tags (
  document_id INT NOT NULL,
  tag_id INT NOT NULL,
  PRIMARY KEY (document_id, tag_id),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS document_custom_fields (
  id INT AUTO_INCREMENT PRIMARY KEY,
  document_id INT NOT NULL,
  field_id INT NOT NULL,
  value_string VARCHAR(500) DEFAULT NULL,
  value_date DATE DEFAULT NULL,
  value_integer INT DEFAULT NULL,
  value_boolean BOOLEAN DEFAULT NULL,
  value_decimal DECIMAL(12,2) DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_doc_field (document_id, field_id),
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (field_id) REFERENCES custom_field_definitions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS matching_rules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  entity_type ENUM('tag','category','institution') NOT NULL,
  entity_id INT NOT NULL,
  match_pattern VARCHAR(500) NOT NULL,
  matching_algorithm ENUM('exact','any_word','all_words','regex','fuzzy') NOT NULL DEFAULT 'any_word',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Indexes
-- ============================================================

-- documents
CREATE INDEX idx_documents_category ON documents(category_id);
CREATE INDEX idx_documents_user ON documents(user_id);
CREATE INDEX idx_documents_person ON documents(person_id);
CREATE INDEX idx_documents_date ON documents(document_date);
CREATE INDEX idx_documents_institution ON documents(institution_id);
CREATE INDEX idx_documents_expires ON documents(expires_at);
CREATE INDEX idx_documents_parent_uuid ON documents(parent_uuid);
CREATE INDEX idx_documents_version ON documents(parent_uuid, version);

-- FULLTEXT index for search (MariaDB InnoDB supports FULLTEXT from 10.0.15+)
ALTER TABLE documents ADD FULLTEXT INDEX ft_documents_search (title, extracted_text);

-- audit_log
CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_uuid);
CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_created ON audit_log(created_at);

-- document_tags (PK covers document_id; this index supports tag_id lookups)
CREATE INDEX idx_document_tags_tag ON document_tags(tag_id);

-- document_custom_fields
CREATE INDEX idx_custom_fields_document ON document_custom_fields(document_id);
CREATE INDEX idx_custom_fields_field ON document_custom_fields(field_id);

-- matching_rules
CREATE INDEX idx_matching_rules_entity ON matching_rules(entity_type, entity_id);
CREATE INDEX idx_matching_rules_active ON matching_rules(is_active);
