import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { adminAssets, getUsers } from '../../services/api';
import type { Asset, User } from '../../types';

// Consistent input class per style guide
const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

export default function AssetsPage() {
  const { t } = useTranslation();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', slug: '', asset_type: 'car' as Asset['asset_type'], owner_id: '', notes: '' });
  const [attrs, setAttrs] = useState<{ key: string; value: string }[]>([]);
  const [error, setError] = useState('');

  async function load() {
    const [a, u] = await Promise.all([adminAssets.list(), getUsers()]);
    setAssets(a);
    setUsers(u);
  }

  useEffect(() => { load(); }, []);

  function autoSlug(value: string) {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  function startCreate() {
    setForm({ name: '', slug: '', asset_type: 'car', owner_id: '', notes: '' });
    setAttrs([{ key: '', value: '' }]);
    setCreating(true);
    setEditing(null);
    setError('');
  }

  function startEdit(asset: Asset) {
    setForm({ name: asset.name, slug: asset.slug, asset_type: asset.asset_type, owner_id: String(asset.owner_id), notes: asset.notes || '' });
    setAttrs(Object.entries(asset.attributes || {}).map(([key, value]) => ({ key, value })));
    if (Object.keys(asset.attributes || {}).length === 0) setAttrs([{ key: '', value: '' }]);
    setEditing(asset);
    setCreating(false);
    setError('');
  }

  function cancelForm() { setCreating(false); setEditing(null); setError(''); }

  function addAttrRow() { setAttrs(a => [...a, { key: '', value: '' }]); }
  function removeAttrRow(idx: number) { setAttrs(a => a.filter((_, i) => i !== idx)); }
  function updateAttr(idx: number, field: 'key' | 'value', val: string) {
    setAttrs(a => a.map((row, i) => i === idx ? { ...row, [field]: val } : row));
  }

  async function handleSave() {
    setError('');
    const attributes: Record<string, string> = {};
    for (const a of attrs) { if (a.key && a.value) attributes[a.key] = a.value; }
    const body = { ...form, owner_id: parseInt(form.owner_id), attributes };
    try {
      if (creating) await adminAssets.create(body);
      else if (editing) await adminAssets.update(editing.id, body);
      cancelForm();
      await load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed');
    }
  }

  async function handleDelete(asset: Asset) {
    if (!confirm(t('admin.confirmDelete'))) return;
    try {
      await adminAssets.remove(asset.id);
      await load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      alert(msg || 'Failed');
    }
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
          {error && <div className="bg-red-50 text-red-700 px-4 py-2 rounded-lg text-sm mb-4">{error}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('admin.name')} *</label>
              <input className={inputCls} value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value, slug: autoSlug(e.target.value) }))} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('admin.slug')}</label>
              <input className={inputCls} value={form.slug}
                onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('admin.dataType')} *</label>
              <select className={inputCls} value={form.asset_type}
                onChange={e => setForm(f => ({ ...f, asset_type: e.target.value as Asset['asset_type'] }))}>
                {['car', 'house', 'boat', 'appliance', 'other'].map(type => (
                  <option key={type} value={type}>{t(`assets.types.${type}`)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('upload.personLabel')} *</label>
              <select className={inputCls} value={form.owner_id}
                onChange={e => setForm(f => ({ ...f, owner_id: e.target.value }))}>
                <option value="">{t('common.select')}</option>
                {users.filter(u => u.can_login).map(u => (
                  <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Dynamic attributes */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('admin.attributes')}</label>
            <div className="space-y-2">
              {attrs.map((row, idx) => (
                <div key={idx} className="flex gap-2">
                  <input className={'flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'}
                    placeholder={t('admin.attributeKey')} value={row.key} onChange={e => updateAttr(idx, 'key', e.target.value)} />
                  <input className={'flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'}
                    placeholder={t('admin.attributeValue')} value={row.value} onChange={e => updateAttr(idx, 'value', e.target.value)} />
                  <button onClick={() => removeAttrRow(idx)} className="text-red-500 text-sm px-2 hover:text-red-700">&times;</button>
                </div>
              ))}
              <button onClick={addAttrRow} className="text-blue-600 text-xs hover:underline">+ {t('admin.addAttribute')}</button>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={handleSave} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">{t('admin.save')}</button>
            <button onClick={cancelForm} className="border border-gray-300 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">{t('admin.cancel')}</button>
          </div>
        </div>
      )}

      {/* Asset list */}
      <div className="space-y-3">
        {assets.length === 0 ? (
          <p className="text-gray-400 text-center py-8 text-sm">{t('admin.noEntries')}</p>
        ) : assets.map(asset => (
          <div key={asset.id} className="bg-white rounded-xl shadow-sm p-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-medium">{asset.name}</h3>
                <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">{t(`assets.types.${asset.asset_type}`)}</span>
                <span className="text-xs text-gray-400 ml-2">{t('admin.userForm.owner')}: {asset.owner_first_name} {asset.owner_last_name}</span>
                {Object.keys(asset.attributes || {}).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {Object.entries(asset.attributes).map(([k, v]) => (
                      <span key={k} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                        {k}: {v}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => startEdit(asset)} className="text-blue-600 hover:underline text-xs">{t('admin.edit')}</button>
                <button onClick={() => handleDelete(asset)} className="text-red-600 hover:underline text-xs">{t('admin.delete')}</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
