import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getDocuments, getCategories, getUsers } from '../services/api';
import type { Document, Category, User, DocumentFilters } from '../types';

export default function DashboardPage() {
  const { t } = useTranslation();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState<DocumentFilters>({
    category: '',
    person: undefined,
    q: '',
    sort: 'date_desc'
  });

  async function loadDocuments(currentPage = 1) {
    setLoading(true);
    try {
      const result = await getDocuments({ ...filters, page: currentPage });
      setDocuments(result.documents);
      setTotal(result.pagination.total);
      setPages(result.pagination.pages);
      setPage(result.pagination.page);
    } catch (err) {
      console.error('Failed to load documents:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    Promise.all([getCategories(), getUsers()]).then(([cats, usrs]) => {
      setCategories(cats);
      setUsers(usrs);
    });
  }, []);

  useEffect(() => {
    loadDocuments(1);
  }, [filters]);

  function formatDate(dateStr: string | null) {
    if (!dateStr) return t('common.dash');
    return new Date(dateStr).toLocaleDateString();
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div>
      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <input
            type="search"
            placeholder={t('dashboard.searchPlaceholder')}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={filters.q || ''}
            onChange={e => setFilters(f => ({ ...f, q: e.target.value }))}
          />
          <select
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={filters.category || ''}
            onChange={e => setFilters(f => ({ ...f, category: e.target.value }))}
          >
            <option value="">{t('dashboard.allCategories')}</option>
            {categories.map(c => (
              <option key={c.id} value={c.slug}>{c.name}</option>
            ))}
          </select>
          <select
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={filters.person ?? ''}
            onChange={e => setFilters(f => ({ ...f, person: e.target.value ? parseInt(e.target.value) : undefined }))}
          >
            <option value="">{t('dashboard.allMembers')}</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>
            ))}
          </select>
          <select
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={filters.sort || 'date_desc'}
            onChange={e => setFilters(f => ({ ...f, sort: e.target.value }))}
          >
            <option value="date_desc">{t('dashboard.sortNewest')}</option>
            <option value="date_asc">{t('dashboard.sortOldest')}</option>
            <option value="title_asc">{t('dashboard.sortTitle')}</option>
            <option value="created_desc">{t('dashboard.sortRecent')}</option>
          </select>
        </div>
      </div>

      {/* Results count */}
      <div className="text-sm text-gray-500 mb-3">
        {t('dashboard.documentsFound', { count: total })}
      </div>

      {/* Document list */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">{t('common.loading')}</div>
      ) : documents.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 mb-4">{t('dashboard.noDocuments')}</p>
          <Link to="/upload" className="text-blue-600 hover:underline">{t('dashboard.uploadFirst')}</Link>
        </div>
      ) : (
        <div className="space-y-2">
          {documents.map(doc => (
            <Link
              key={doc.uuid}
              to={`/documents/${doc.uuid}`}
              className="block bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium text-gray-900 truncate">{doc.title}</h3>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1 text-xs text-gray-500">
                    <span className="inline-flex items-center bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                      {doc.category_name}
                    </span>
                    <span>{doc.person_first_name} {doc.person_last_name}</span>
                    {doc.institution_name && <span>{doc.institution_name}</span>}
                    <span>{formatDate(doc.document_date)}</span>
                    <span>{formatSize(doc.file_size)}</span>
                  </div>
                </div>
                <span className="text-gray-300 text-lg shrink-0">&#8250;</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex justify-center gap-2 mt-6">
          <button
            disabled={page <= 1}
            onClick={() => loadDocuments(page - 1)}
            className="px-3 py-1 text-sm border rounded-lg disabled:opacity-30 hover:bg-gray-100"
          >
            {t('dashboard.previous')}
          </button>
          <span className="px-3 py-1 text-sm text-gray-600">
            {t('dashboard.pageOf', { page, pages })}
          </span>
          <button
            disabled={page >= pages}
            onClick={() => loadDocuments(page + 1)}
            className="px-3 py-1 text-sm border rounded-lg disabled:opacity-30 hover:bg-gray-100"
          >
            {t('dashboard.next')}
          </button>
        </div>
      )}
    </div>
  );
}
