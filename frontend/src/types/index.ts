// ---- Core entities ----

export interface User {
  id: number;
  email: string | null;
  first_name: string;
  last_name: string;
  role: 'admin' | 'member';
  can_login: boolean;
  created_at?: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
}

export interface Institution {
  id: number;
  name: string;
  slug: string;
  created_at?: string;
}

export interface Tag {
  id: number;
  name: string;
  slug: string;
  color: string;
  created_at?: string;
}

// ---- Documents ----

export interface Document {
  id: number;
  uuid: string;
  user_id: number;
  person_id: number;
  person_first_name: string;
  person_last_name: string;
  title: string;
  category_id: number;
  category_name: string;
  category_slug: string;
  institution_id: number | null;
  institution_name: string | null;
  document_date: string | null;
  file_size: number;
  original_filename: string;
  notes: string | null;
  extracted_text: string | null;
  expires_at: string | null;
  reminder_sent: boolean;
  version: number;
  parent_uuid: string | null;
  created_at: string;
  updated_at: string;
  uploaded_by_first: string;
  uploaded_by_last: string;
  tags?: Tag[];
  custom_fields?: DocumentCustomField[];
}

export interface DocumentsResponse {
  documents: Document[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface DocumentFilters {
  category?: string;
  person?: number;
  institution?: number;
  tag?: string;
  q?: string;
  from?: string;
  to?: string;
  expiring_before?: string;
  sort?: string;
  page?: number;
  limit?: number;
}

// ---- Custom fields ----

export interface CustomFieldDefinition {
  id: number;
  name: string;
  slug: string;
  data_type: 'string' | 'date' | 'integer' | 'boolean' | 'monetary' | 'url';
  created_at?: string;
}

export interface DocumentCustomField {
  id: number;
  document_id: number;
  field_id: number;
  field_name?: string;
  field_slug?: string;
  data_type?: CustomFieldDefinition['data_type'];
  value_string: string | null;
  value_date: string | null;
  value_integer: number | null;
  value_boolean: boolean | null;
  value_decimal: number | null;
  created_at?: string;
}

// ---- Auto-matching ----

export interface MatchingRule {
  id: number;
  entity_type: 'tag' | 'category' | 'institution';
  entity_id: number;
  match_pattern: string;
  matching_algorithm: 'exact' | 'any_word' | 'all_words' | 'regex' | 'fuzzy';
  is_active: boolean;
  created_at?: string;
}

// ---- Audit trail ----

export interface AuditLogEntry {
  id: number;
  user_id: number | null;
  action: 'create' | 'update' | 'delete' | 'login' | 'logout' | 'download';
  entity_type: string;
  entity_id: number | null;
  entity_uuid: string | null;
  details: Record<string, unknown> | null;
  ip_address: string;
  created_at: string;
  user_first_name?: string;
  user_last_name?: string;
}
