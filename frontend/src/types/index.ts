export interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  created_at?: string;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
}

export interface Document {
  id: number;
  uuid: string;
  person_name: string;
  title: string;
  institution: string | null;
  document_date: string | null;
  file_size: number;
  original_filename: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  category_name: string;
  category_slug: string;
  category_id?: number;
  uploaded_by_first: string;
  uploaded_by_last: string;
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
  person?: string;
  institution?: string;
  q?: string;
  from?: string;
  to?: string;
  sort?: string;
  page?: number;
  limit?: number;
}
