-- Digital Family - Seed Data

-- Default categories
INSERT IGNORE INTO categories (name, slug) VALUES
  ('Working Attestation', 'working-attestation'),
  ('Exams', 'exams'),
  ('Titles', 'titles'),
  ('Vaccines', 'vaccines'),
  ('Contracts', 'contracts'),
  ('Insurance', 'insurance'),
  ('ID Documents', 'id-documents'),
  ('Receipts', 'receipts'),
  ('Invoices', 'invoices'),
  ('Medical Records', 'medical-records'),
  ('Certificates', 'certificates'),
  ('Uncategorized', 'uncategorized');

-- Family members (update emails and passwords before deploying)
-- password_hash values are bcrypt placeholders — generate real hashes before first use
INSERT IGNORE INTO users (email, password_hash, first_name, last_name, role, can_login) VALUES
  ('member1@example.com', '$2b$10$PLACEHOLDER_HASH_REPLACE_ME_1', 'Member', 'One', 'admin', TRUE),
  ('member2@example.com', '$2b$10$PLACEHOLDER_HASH_REPLACE_ME_2', 'Member', 'Two', 'member', TRUE),
  ('member3@example.com', '$2b$10$PLACEHOLDER_HASH_REPLACE_ME_3', 'Member', 'Three', 'member', TRUE),
  ('member4@example.com', '$2b$10$PLACEHOLDER_HASH_REPLACE_ME_4', 'Member', 'Four', 'member', TRUE);

-- Household account for family-wide documents (invoices, bills shared by all)
INSERT INTO users (email, password_hash, first_name, last_name, role, can_login)
SELECT NULL, NULL, 'Household', 'Account', 'member', FALSE
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM users WHERE first_name = 'Household' AND last_name = 'Account');

-- Pet members (no email, cannot login)
INSERT INTO users (email, password_hash, first_name, last_name, role, can_login)
SELECT NULL, NULL, 'Whiskers', 'Family', 'member', FALSE
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM users WHERE first_name = 'Whiskers' AND last_name = 'Family');

INSERT INTO users (email, password_hash, first_name, last_name, role, can_login)
SELECT NULL, NULL, 'Mittens', 'Family', 'member', FALSE
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM users WHERE first_name = 'Mittens' AND last_name = 'Family');

-- Default institutions (update before deploying)
INSERT IGNORE INTO institutions (name, slug) VALUES
  ('General Hospital', 'general-hospital'),
  ('City Hall', 'city-hall'),
  ('Tax Office', 'tax-office'),
  ('Health Insurance', 'health-insurance'),
  ('Veterinary Clinic', 'veterinary-clinic'),
  ('School District', 'school-district'),
  ('Employer Inc.', 'employer-inc');

-- Example assets (update before deploying)
INSERT IGNORE INTO assets (name, slug, asset_type, owner_id) VALUES
  ('Family Car', 'family-car', 'car', 1),
  ('Apartment', 'apartment', 'house', 1);

-- Example asset attributes
INSERT IGNORE INTO asset_attributes (asset_id, attribute_name, attribute_value) VALUES
  (1, 'brand', 'Volvo'),
  (1, 'model', 'XC60'),
  (1, 'year', '2021'),
  (1, 'license_plate', 'ZH 123456'),
  (1, 'color', 'Black'),
  (2, 'address', 'Musterstrasse 42, 8001 Zürich'),
  (2, 'purchase_year', '2018');

-- Example pet attributes (Whiskers)
INSERT INTO user_attributes (user_id, attribute_name, attribute_value)
SELECT u.id, 'date_of_birth', '2019-03-15' FROM users u WHERE u.first_name = 'Whiskers' AND u.last_name = 'Family'
ON DUPLICATE KEY UPDATE attribute_value = VALUES(attribute_value);
INSERT INTO user_attributes (user_id, attribute_name, attribute_value)
SELECT u.id, 'color', 'Orange Tabby' FROM users u WHERE u.first_name = 'Whiskers' AND u.last_name = 'Family'
ON DUPLICATE KEY UPDATE attribute_value = VALUES(attribute_value);
INSERT INTO user_attributes (user_id, attribute_name, attribute_value)
SELECT u.id, 'breed', 'European Shorthair' FROM users u WHERE u.first_name = 'Whiskers' AND u.last_name = 'Family'
ON DUPLICATE KEY UPDATE attribute_value = VALUES(attribute_value);

-- Default tags
INSERT IGNORE INTO tags (name, slug, color) VALUES
  ('Urgent', 'urgent', '#EF4444'),
  ('Archived', 'archived', '#6B7280'),
  ('Pending Review', 'pending-review', '#F59E0B'),
  ('Tax Relevant', 'tax-relevant', '#10B981'),
  ('Pet', 'pet', '#8B5CF6'),
  ('Expiring Soon', 'expiring-soon', '#F97316'),
  ('Paid', 'paid', '#10B981'),
  ('Unpaid', 'unpaid', '#EF4444'),
  ('Overdue', 'overdue', '#DC2626');

-- Invoice custom field definitions (EAV — attached per-document, no schema change)
INSERT IGNORE INTO custom_field_definitions (name, slug, data_type) VALUES
  ('Invoice Number', 'invoice-number', 'string'),
  ('Amount', 'amount', 'monetary'),
  ('Currency', 'currency', 'string'),
  ('VAT', 'vat', 'monetary'),
  ('Paid Date', 'paid-date', 'date'),
  ('Payment Method', 'payment-method', 'string');

-- Matching rules to auto-detect invoices from email/PDF content
INSERT IGNORE INTO matching_rules (entity_type, entity_id, match_pattern, matching_algorithm, is_active)
SELECT 'category', id, 'invoice rechnung factura bill quittung', 'any_word', TRUE
FROM categories WHERE slug = 'invoices';

INSERT IGNORE INTO matching_rules (entity_type, entity_id, match_pattern, matching_algorithm, is_active)
SELECT 'category', id, 'Rechnungsbetrag|Rechnungsnummer|Rechnungsdatum|invoice amount|invoice number', 'regex', TRUE
FROM categories WHERE slug = 'invoices';
