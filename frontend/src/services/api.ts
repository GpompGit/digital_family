import axios from 'axios';
import type { Category, Document, DocumentsResponse, DocumentFilters, User, Institution, Tag } from '../types';

const api = axios.create({
  baseURL: '/',
  withCredentials: true
});

// Auth
export async function checkAuth(): Promise<{ authenticated: boolean; user?: User }> {
  const { data } = await api.get('/auth/status');
  return data;
}

export async function login(email: string, password: string): Promise<{ message: string }> {
  const { data } = await api.post('/auth/login', { email, password });
  return data;
}

export async function logout(): Promise<void> {
  await api.post('/auth/logout');
}

// Categories
export async function getCategories(): Promise<Category[]> {
  const { data } = await api.get('/api/categories');
  return data;
}

// Users
export async function getUsers(): Promise<User[]> {
  const { data } = await api.get('/api/users');
  return data;
}

// Institutions
export async function getInstitutions(): Promise<Institution[]> {
  const { data } = await api.get('/api/institutions');
  return data;
}

// Tags
export async function getTags(): Promise<Tag[]> {
  const { data } = await api.get('/api/tags');
  return data;
}

// Documents
export async function getDocuments(filters: DocumentFilters = {}): Promise<DocumentsResponse> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') {
      params.set(key, String(value));
    }
  }
  const { data } = await api.get(`/api/documents?${params}`);
  return data;
}

export async function getDocument(uuid: string): Promise<Document> {
  const { data } = await api.get(`/api/documents/${uuid}`);
  return data;
}

export async function uploadDocument(formData: FormData): Promise<{ uuid: string }> {
  const { data } = await api.post('/api/documents', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return data;
}

export async function updateDocument(uuid: string, body: Record<string, unknown>): Promise<void> {
  await api.put(`/api/documents/${uuid}`, body);
}

export async function deleteDocument(uuid: string): Promise<void> {
  await api.delete(`/api/documents/${uuid}`);
}

export function getFileUrl(uuid: string): string {
  return `/api/documents/${uuid}/file`;
}
