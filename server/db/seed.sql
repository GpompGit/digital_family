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

-- Family members (update emails before deploying)
INSERT IGNORE INTO users (email, first_name, last_name) VALUES
  ('member1@example.com', 'Member', 'One'),
  ('member2@example.com', 'Member', 'Two'),
  ('member3@example.com', 'Member', 'Three'),
  ('member4@example.com', 'Member', 'Four');
