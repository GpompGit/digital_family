// =============================================================================
// types/index.ts — TypeScript Interfaces (Shared Type Definitions)
// =============================================================================
//
// WHAT ARE TYPESCRIPT INTERFACES?
// Interfaces define the "shape" of data — what fields an object has and
// what types those fields are. They don't generate any JavaScript code;
// they exist only at compile time to catch bugs early.
//
// For example, if the backend returns { id: 1, email: "a@b.com" } but
// you accidentally try to access user.name, TypeScript will show an error
// BEFORE you run the code. Without TypeScript, you'd get "undefined" at runtime.
//
// TYPE SYNTAX:
//   string              — text: "hello"
//   number              — any number: 42, 3.14
//   boolean             — true or false
//   string | null       — EITHER a string OR null (called a "union type")
//   'admin' | 'member'  — EXACTLY one of these strings (called a "literal type")
//   Tag[]               — an array of Tag objects
//   Record<string, unknown> — an object with string keys and any values (like JSON)
//   created_at?: string — the "?" means this field is OPTIONAL (may be missing)
//
// WHY SEPARATE FILE?
// These types are used by BOTH the frontend pages and the API service.
// Keeping them in one place avoids duplication and ensures consistency.
// =============================================================================


// ---- Core entities (match the database tables) ----

// A family member or pet. Pets have email=null and can_login=false.
export interface User {
  id: number;
  email: string | null;        // null for pets (they can't log in)
  first_name: string;
  last_name: string;
  role: 'admin' | 'member';   // literal union type — only these two values are allowed
  can_login: boolean;
  created_at?: string;         // optional — not always returned by the API
}

// Document type/category (e.g., "Insurance", "Vaccines", "Contracts")
export interface Category {
  id: number;
  name: string;   // display name: "ID Documents"
  slug: string;   // URL-safe version: "id-documents"
}

// Organization that issues documents (e.g., "General Hospital")
export interface Institution {
  id: number;
  name: string;
  slug: string;
  created_at?: string;
}

// Flexible labels that can be applied to documents (many-to-many)
export interface Tag {
  id: number;
  name: string;
  slug: string;
  color: string;   // hex color code, e.g., "#EF4444"
  created_at?: string;
}


// ---- Documents ----

// A single document with all its metadata.
// Some fields (person_first_name, category_name, etc.) come from JOINed tables —
// they're not columns in the documents table, but are included in the API response
// to avoid the frontend needing to make separate requests.
export interface Document {
  id: number;
  uuid: string;                      // public identifier (used in URLs instead of id)
  user_id: number;                   // who uploaded this document
  person_id: number;                 // who this document belongs to
  person_first_name: string;         // JOINed from users table
  person_last_name: string;          // JOINed from users table
  title: string;
  category_id: number;
  category_name: string;             // JOINed from categories table
  category_slug: string;             // JOINed from categories table
  institution_id: number | null;     // null if no institution assigned
  institution_name: string | null;   // JOINed from institutions table
  document_date: string | null;      // ISO date string or null
  file_size: number;                 // in bytes
  original_filename: string;         // the name the user uploaded (for download)
  notes: string | null;
  extracted_text: string | null;     // OCR content (future feature)
  expires_at: string | null;         // document expiry date
  reminder_sent: boolean;
  version: number;
  parent_uuid: string | null;        // original document UUID (for versions)
  created_at: string;
  updated_at: string;
  uploaded_by_first: string;         // JOINed: uploader's first name
  uploaded_by_last: string;          // JOINed: uploader's last name
  tags?: Tag[];                      // optional: populated by separate query
  custom_fields?: DocumentCustomField[]; // optional: populated by separate query
}

// The paginated response from GET /api/documents
export interface DocumentsResponse {
  documents: Document[];
  pagination: {
    page: number;    // current page number
    limit: number;   // results per page
    total: number;   // total matching documents
    pages: number;   // total number of pages
  };
}

// Query parameters for filtering and sorting documents
export interface DocumentFilters {
  category?: string;         // filter by category slug
  person?: number;           // filter by person_id (user ID)
  institution?: number;      // filter by institution_id
  tag?: string;              // filter by tag slug
  q?: string;                // full-text search query
  from?: string;             // document_date >= this date
  to?: string;               // document_date <= this date
  expiring_before?: string;  // expires_at <= this date
  sort?: string;             // 'date_desc', 'date_asc', 'title_asc', 'created_desc'
  page?: number;
  limit?: number;
}


// ---- Custom fields (EAV pattern) ----

// Definition of a custom metadata field (e.g., "Policy Number" of type "string")
export interface CustomFieldDefinition {
  id: number;
  name: string;
  slug: string;
  data_type: 'string' | 'date' | 'integer' | 'boolean' | 'monetary' | 'url';
  created_at?: string;
}

// A custom field value attached to a specific document.
// Only ONE of the value_* fields will be non-null, based on data_type.
export interface DocumentCustomField {
  id: number;
  document_id: number;
  field_id: number;
  field_name?: string;                       // JOINed from custom_field_definitions
  field_slug?: string;                       // JOINed
  data_type?: CustomFieldDefinition['data_type']; // JOINed — reuses the type from CustomFieldDefinition
  value_string: string | null;
  value_date: string | null;
  value_integer: number | null;
  value_boolean: boolean | null;
  value_decimal: number | null;              // for monetary amounts
  created_at?: string;
}


// ---- Auto-matching (future feature) ----

// A rule for automatically assigning tags/categories/institutions based on OCR text
export interface MatchingRule {
  id: number;
  entity_type: 'tag' | 'category' | 'institution'; // which table entity_id refers to
  entity_id: number;
  match_pattern: string;
  matching_algorithm: 'exact' | 'any_word' | 'all_words' | 'regex' | 'fuzzy';
  is_active: boolean;
  created_at?: string;
}


// ---- Audit trail ----

// One entry in the audit log (displayed in admin settings)
export interface AuditLogEntry {
  id: number;
  user_id: number | null;                    // null for unauthenticated actions
  action: 'create' | 'update' | 'delete' | 'login' | 'logout' | 'download';
  entity_type: string;
  entity_id: number | null;
  entity_uuid: string | null;
  details: Record<string, unknown> | null;   // flexible JSON data
  ip_address: string;
  created_at: string;
  user_first_name?: string;                  // JOINed from users table
  user_last_name?: string;                   // JOINed from users table
}
