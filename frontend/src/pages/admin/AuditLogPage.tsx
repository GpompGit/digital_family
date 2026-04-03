import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getAuditLog } from '../../services/api';
import type { AuditLogEntry } from '../../types';

// Consistent input class per style guide
const inputCls = 'px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

export default function AuditLogPage() {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [filters, setFilters] = useState({ action: '', entity_type: '', from: '', to: '' });

  async function load(p = 1) {
    const params = new URLSearchParams();
    params.set('page', String(p));
    params.set('limit', '30');
    if (filters.action) params.set('action', filters.action);
    if (filters.entity_type) params.set('entity_type', filters.entity_type);
    if (filters.from) params.set('from', filters.from);
    if (filters.to) params.set('to', filters.to);

    const data = await getAuditLog(params);
    setEntries(data.entries as unknown as AuditLogEntry[]);
    setTotal(data.pagination.total);
    setPages(data.pagination.pages);
    setPage(data.pagination.page);
  }

  useEffect(() => { load(1); }, [filters]);

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleString();
  }

  return (
    <div>
      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <select className={inputCls} value={filters.action} onChange={e => setFilters(f => ({ ...f, action: e.target.value }))}>
            <option value="">{t('admin.audit.allActions')}</option>
            <option value="create">create</option>
            <option value="update">update</option>
            <option value="delete">delete</option>
            <option value="login">login</option>
            <option value="logout">logout</option>
            <option value="download">download</option>
          </select>
          <select className={inputCls} value={filters.entity_type} onChange={e => setFilters(f => ({ ...f, entity_type: e.target.value }))}>
            <option value="">{t('admin.audit.allTypes')}</option>
            <option value="document">document</option>
            <option value="user">user</option>
            <option value="category">category</option>
            <option value="institution">institution</option>
            <option value="tag">tag</option>
            <option value="asset">asset</option>
          </select>
          <input type="date" className={inputCls} value={filters.from} onChange={e => setFilters(f => ({ ...f, from: e.target.value }))} />
          <input type="date" className={inputCls} value={filters.to} onChange={e => setFilters(f => ({ ...f, to: e.target.value }))} />
        </div>
      </div>

      <div className="text-sm text-gray-500 mb-3">{total} {t('admin.auditLog')}</div>

      {/* Entries */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {entries.length === 0 ? (
          <p className="text-gray-400 text-center py-8 text-sm">{t('admin.noEntries')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
                <tr>
                  <th className="px-4 py-3">{t('admin.audit.date')}</th>
                  <th className="px-4 py-3">{t('admin.audit.user')}</th>
                  <th className="px-4 py-3">{t('admin.audit.actionLabel')}</th>
                  <th className="px-4 py-3">{t('admin.audit.entity')}</th>
                  <th className="px-4 py-3 hidden sm:table-cell">{t('admin.audit.ipAddress')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {entries.map(entry => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(entry.created_at)}</td>
                    <td className="px-4 py-3">
                      {entry.user_first_name
                        ? `${entry.user_first_name} ${entry.user_last_name}`
                        : t('admin.audit.system')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        entry.action === 'delete' ? 'bg-red-50 text-red-700' :
                        entry.action === 'create' ? 'bg-green-50 text-green-700' :
                        entry.action === 'login' ? 'bg-blue-50 text-blue-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {entry.action}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-600">{entry.entity_type}</span>
                      {entry.entity_uuid && <span className="text-gray-400 text-xs ml-1">({entry.entity_uuid.slice(0, 8)})</span>}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell text-gray-400 text-xs">{entry.ip_address}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button disabled={page <= 1} onClick={() => load(page - 1)} className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-30 hover:bg-gray-100">
            {t('dashboard.previous')}
          </button>
          <span className="px-3 py-1 text-sm text-gray-600">{page} / {pages}</span>
          <button disabled={page >= pages} onClick={() => load(page + 1)} className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-30 hover:bg-gray-100">
            {t('dashboard.next')}
          </button>
        </div>
      )}
    </div>
  );
}
