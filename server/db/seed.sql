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
  ('Medical Records', 'medical-records'),
  ('Certificates', 'certificates');

-- Family members (update emails and passwords before deploying)
-- password_hash values are bcrypt placeholders — generate real hashes before first use
INSERT IGNORE INTO users (email, password_hash, first_name, last_name, role, can_login) VALUES
  ('member1@example.com', '$2b$10$PLACEHOLDER_HASH_REPLACE_ME_1', 'Member', 'One', 'admin', TRUE),
  ('member2@example.com', '$2b$10$PLACEHOLDER_HASH_REPLACE_ME_2', 'Member', 'Two', 'member', TRUE),
  ('member3@example.com', '$2b$10$PLACEHOLDER_HASH_REPLACE_ME_3', 'Member', 'Three', 'member', TRUE),
  ('member4@example.com', '$2b$10$PLACEHOLDER_HASH_REPLACE_ME_4', 'Member', 'Four', 'member', TRUE);

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

-- Default tags
INSERT IGNORE INTO tags (name, slug, color) VALUES
  ('Urgent', 'urgent', '#EF4444'),
  ('Archived', 'archived', '#6B7280'),
  ('Pending Review', 'pending-review', '#F59E0B'),
  ('Tax Relevant', 'tax-relevant', '#10B981'),
  ('Pet', 'pet', '#8B5CF6'),
  ('Expiring Soon', 'expiring-soon', '#F97316');
