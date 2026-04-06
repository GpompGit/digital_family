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

-- Admin user — add more family members via the admin panel after first login
INSERT IGNORE INTO users (email, password_hash, first_name, last_name, role, can_login) VALUES
  ('g.pomphile@gmx.net', '$2b$10$jtvG8ngmWMjUmNJLN2.t7.zrQsX//K.UiV0bGYNeTJFe7jwlSSqn6', 'Guillermo', 'Pomphile', 'admin', TRUE);

-- Household account for family-wide documents (invoices, bills shared by all)
INSERT INTO users (email, password_hash, first_name, last_name, role, can_login)
SELECT NULL, NULL, 'Household', 'Account', 'member', FALSE
FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM users WHERE first_name = 'Household' AND last_name = 'Account');

-- Default institutions (update before deploying)
INSERT IGNORE INTO institutions (name, slug) VALUES
  ('Not Assigned', 'not-assigned'),
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
