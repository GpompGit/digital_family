// =============================================================================
// api.ts — Frontend API Client (HTTP requests to the backend)
// =============================================================================
//
// This file contains ALL functions that communicate with the backend.
// Every API call in the app goes through this file — it's the single
// point of contact between frontend and backend.
//
// WHY CENTRALIZE API CALLS?
//   - If the API URL changes, you change it in one place
//   - Consistent error handling and configuration
//   - Easy to see all available endpoints at a glance
//   - Components stay clean (they call getDocuments(), not axios.get('/api/...'))
//
// AXIOS:
// Axios is an HTTP client library (like fetch, but with nicer API).
//   - Automatically converts JSON responses to JavaScript objects
//   - Supports request/response interceptors
//   - Better error handling than fetch
//
// withCredentials: true — tells axios to include cookies with every request.
// This is essential because our session cookie needs to be sent to the backend
// on every API call so the server knows who we are.
//
// ASYNC/AWAIT:
// All functions are async — they return Promises that resolve when the
// server responds. In components, you call them with await:
//   const categories = await getCategories();
//
// DESTRUCTURING PATTERN: const { data } = await api.get(...)
// Axios responses have shape { data, status, headers, ... }.
// We only need the data, so we destructure it immediately.
// =============================================================================

import axios from 'axios';
import type { Category, Document, DocumentsResponse, DocumentFilters, User, Institution, Tag, Asset } from '../types';

// Create an axios instance with shared configuration.
// All requests will use these defaults.
const api = axios.create({
  baseURL: '/',            // relative URLs — requests go to the same server
  withCredentials: true    // include session cookies with every request
});

// =============================================================================
// AUTH — Login, logout, check session status
// =============================================================================

// Check if the user has an active session (called on app startup by AuthContext)
export async function checkAuth(): Promise<{ authenticated: boolean; user?: User }> {
  const { data } = await api.get('/auth/status');
  return data;
}

// Log in with email + password. The "website" parameter is the honeypot field
// (see LoginPage.tsx for explanation).
export async function login(email: string, password: string, website?: string): Promise<{ message: string }> {
  const { data } = await api.post('/auth/login', { email, password, website });
  return data;
}

// Log out — destroys the session on the server
export async function logout(): Promise<void> {
  await api.post('/auth/logout');
}

// =============================================================================
// LOOKUP DATA — Used for dropdowns and filters in the UI
// =============================================================================

export async function getCategories(): Promise<Category[]> {
  const { data } = await api.get('/api/categories');
  return data;
}

export async function getUsers(): Promise<User[]> {
  const { data } = await api.get('/api/users');
  return data;
}

export async function getInstitutions(): Promise<Institution[]> {
  const { data } = await api.get('/api/institutions');
  return data;
}

export async function getTags(): Promise<Tag[]> {
  const { data } = await api.get('/api/tags');
  return data;
}

export async function getAssets(): Promise<Asset[]> {
  const { data } = await api.get('/api/assets');
  return data;
}

// =============================================================================
// DOCUMENTS — CRUD operations (Create, Read, Update, Delete)
// =============================================================================

// Get a filtered, sorted, paginated list of documents.
// Converts the filters object into URL query parameters:
//   { category: 'insurance', page: 2 } → "?category=insurance&page=2"
export async function getDocuments(filters: DocumentFilters = {}): Promise<DocumentsResponse> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    // Only include non-empty values (skip undefined, null, empty strings)
    if (value !== undefined && value !== '') {
      params.set(key, String(value));
    }
  }
  const { data } = await api.get(`/api/documents?${params}`);
  return data;
}

// Get a single document by UUID (includes all metadata from JOINed tables)
export async function getDocument(uuid: string): Promise<Document> {
  const { data } = await api.get(`/api/documents/${uuid}`);
  return data;
}

// Upload a new document. Uses FormData because we're sending a file.
// FormData is the browser's way of encoding multipart/form-data (files + text fields).
export async function uploadDocument(formData: FormData): Promise<{ uuid: string }> {
  const { data } = await api.post('/api/documents', formData, {
    headers: { 'Content-Type': 'multipart/form-data' } // tell the server it's a file upload
  });
  return data;
}

// Update document metadata (no file change — just title, category, etc.)
export async function updateDocument(uuid: string, body: Record<string, unknown>): Promise<void> {
  await api.put(`/api/documents/${uuid}`, body);
}

// Delete a document (only allowed for the uploader or an admin)
export async function deleteDocument(uuid: string): Promise<void> {
  await api.delete(`/api/documents/${uuid}`);
}

// Get the URL for streaming/downloading a PDF file.
// This doesn't make an API call — it just returns the URL that the browser
// can use in <a href>, <iframe>, or window.open().
export function getFileUrl(uuid: string): string {
  return `/api/documents/${uuid}/file`;
}

// =============================================================================
// ADMIN — Functions for admin settings pages
// =============================================================================

// Generic admin CRUD helper — avoids repeating the same pattern for each entity
async function adminGet<T>(path: string): Promise<T> {
  const { data } = await api.get(path);
  return data;
}

async function adminPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const { data } = await api.post(path, body);
  return data;
}

async function adminPut(path: string, body: Record<string, unknown>): Promise<void> {
  await api.put(path, body);
}

async function adminDelete(path: string): Promise<void> {
  await api.delete(path);
}

// Admin Users
export const adminUsers = {
  list: () => adminGet<User[]>('/api/admin/users'),
  create: (body: Record<string, unknown>) => adminPost<{ id: number }>('/api/admin/users', body),
  update: (id: number, body: Record<string, unknown>) => adminPut(`/api/admin/users/${id}`, body),
  remove: (id: number) => adminDelete(`/api/admin/users/${id}`),
  resetPassword: (id: number, password: string) => adminPut(`/api/admin/users/${id}/password`, { password }),
};

// Admin Assets
export const adminAssets = {
  list: () => adminGet<Asset[]>('/api/admin/assets'),
  create: (body: Record<string, unknown>) => adminPost<{ id: number }>('/api/admin/assets', body),
  update: (id: number, body: Record<string, unknown>) => adminPut(`/api/admin/assets/${id}`, body),
  remove: (id: number) => adminDelete(`/api/admin/assets/${id}`),
};

// Admin Metadata (categories, institutions, tags, custom fields)
export function adminMetadata(basePath: string) {
  return {
    list: () => adminGet<Record<string, unknown>[]>(basePath),
    create: (body: Record<string, unknown>) => adminPost<{ id: number }>(basePath, body),
    update: (id: number, body: Record<string, unknown>) => adminPut(`${basePath}/${id}`, body),
    remove: (id: number) => adminDelete(`${basePath}/${id}`),
  };
}

// Admin Audit Log
export async function getAuditLog(params: URLSearchParams): Promise<{ entries: Record<string, unknown>[]; pagination: Record<string, number> }> {
  const { data } = await api.get(`/api/admin/audit?${params}`);
  return data;
}

