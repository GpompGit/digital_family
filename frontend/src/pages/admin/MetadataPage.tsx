import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';

interface Field {
  key: string;
  label: string;
  type?: 'text' | 'color' | 'select';
  options?: { value: string; label: string }[];
  required?: boolean;
}

interface Props {
  apiPath: string;
  fields: Field[];
  titleKey: string;
}

export default function MetadataPage({ apiPath, fields, titleKey }: Props) {
  const { t } = useTranslation();
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  async function load() {
    const { data } = await axios.get(apiPath);
    setItems(data);
  }

  useEffect(() => { load(); }, [apiPath]);

  function emptyForm(): Record<string, string> {
    const obj: Record<string, string> = {};
    for (const f of fields) obj[f.key] = '';
    return obj;
  }

  function startCreate() {
    setForm(emptyForm());
    setCreating(true);
    setEditing(null);
    setError('');
  }

  function startEdit(item: Record<string, unknown>) {
    const obj: Record<string, string> = {};
    for (const f of fields) obj[f.key] = String(item[f.key] ?? '');
    setForm(obj);
    setEditing(item);
    setCreating(false);
    setError('');
  }

  function cancelForm() {
    setCreating(false);
    setEditing(null);
    setError('');
  }

  async function handleSave() {
    setError('');
    try {
      if (creating) {
        await axios.post(apiPath, form);
      } else if (editing) {
        await axios.put(`${apiPath}/${editing.id}`, form);
      }
      cancelForm();
      await load();
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : 'Failed';
      setError(msg || 'Failed');
    }
  }

  async function handleDelete(item: Record<string, unknown>) {
    if (!confirm(t('admin.confirmDelete'))) return;
    try {
      await axios.delete(`${apiPath}/${item.id}`);
      await load();
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : 'Failed';
      alert(msg || 'Failed');
    }
  }

  function autoSlug(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function handleFieldChange(key: string, value: string) {
    setForm(f => {
      const next = { ...f, [key]: value };
      // Auto-generate slug when name changes
      if (key === 'name' && 'slug' in next) {
        next.slug = autoSlug(value);
      }
      return next;
    });
  }

  const showForm = creating || editing;

  return (
    <div>
      {!showForm && (
        <button onClick={startCreate} className="mb-4 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
          + {t('admin.create')}
        </button>
      )}

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-4 space-y-3">
          <h2 className="font-semibold">{creating ? t('admin.create') : t('admin.edit')}</h2>
          {error && <div className="bg-red-50 text-red-700 px-3 py-2 rounded text-sm">{error}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {fields.map(f => (
              <div key={f.key}>
                <label className="block text-xs text-gray-500 mb-1">{f.label}{f.required !== false ? ' *' : ''}</label>
                {f.type === 'color' ? (
                  <div className="flex gap-2 items-center">
                    <input type="color" className="h-9 w-12 rounded border cursor-pointer" value={form[f.key] || '#6B7280'} onChange={e => handleFieldChange(f.key, e.target.value)} />
                    <input type="text" className="flex-1 px-3 py-2 border rounded-lg text-sm" value={form[f.key] || ''} onChange={e => handleFieldChange(f.key, e.target.value)} />
                  </div>
                ) : f.type === 'select' ? (
                  <select className="w-full px-3 py-2 border rounded-lg text-sm" value={form[f.key] || ''} onChange={e => handleFieldChange(f.key, e.target.value)}>
                    <option value="">{t('common.select')}</option>
                    {f.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : (
                  <input type="text" className="w-full px-3 py-2 border rounded-lg text-sm" value={form[f.key] || ''} onChange={e => handleFieldChange(f.key, e.target.value)} />
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={handleSave} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">{t('admin.save')}</button>
            <button onClick={cancelForm} className="border px-4 py-2 rounded-lg text-sm hover:bg-gray-50">{t('admin.cancel')}</button>
          </div>
        </div>
      )}

      {/* Items table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {items.length === 0 ? (
          <p className="text-gray-400 text-center py-8 text-sm">{t('admin.noEntries')}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
              <tr>
                {fields.map(f => (
                  <th key={f.key} className="px-4 py-3">{f.label}</th>
                ))}
                <th className="px-4 py-3">{t('admin.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map(item => (
                <tr key={String(item.id)} className="hover:bg-gray-50">
                  {fields.map(f => (
                    <td key={f.key} className="px-4 py-3">
                      {f.key === 'color' ? (
                        <div className="flex items-center gap-2">
                          <span className="w-4 h-4 rounded-full inline-block" style={{ backgroundColor: String(item[f.key] || '#6B7280') }} />
                          <span className="text-gray-500 text-xs">{String(item[f.key])}</span>
                        </div>
                      ) : (
                        String(item[f.key] ?? '')
                      )}
                    </td>
                  ))}
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => startEdit(item)} className="text-blue-600 hover:underline text-xs">{t('admin.edit')}</button>
                      <button onClick={() => handleDelete(item)} className="text-red-600 hover:underline text-xs">{t('admin.delete')}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
