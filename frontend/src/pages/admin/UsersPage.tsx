import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { adminUsers, getUsers } from '../../services/api';
import type { User } from '../../types';

// Consistent input class per style guide
const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

export default function UsersPage() {
  const { t } = useTranslation();
  const [users, setUsers] = useState<User[]>([]);
  const [editing, setEditing] = useState<User | null>(null);
  const [creating, setCreating] = useState(false);
  const [resetId, setResetId] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [form, setForm] = useState({ email: '', first_name: '', last_name: '', password: '', role: 'member' as const, can_login: false });
  const [error, setError] = useState('');

  async function load() {
    const data = await adminUsers.list();
    setUsers(data);
  }

  useEffect(() => { load(); }, []);

  function startCreate() {
    setForm({ email: '', first_name: '', last_name: '', password: '', role: 'member', can_login: false });
    setCreating(true);
    setEditing(null);
    setError('');
  }

  function startEdit(user: User) {
    setForm({ email: user.email || '', first_name: user.first_name, last_name: user.last_name, password: '', role: user.role, can_login: user.can_login });
    setEditing(user);
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
        await adminUsers.create(form);
      } else if (editing) {
        await adminUsers.update(editing.id, form);
      }
      cancelForm();
      await load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg || 'Failed');
    }
  }

  async function handleDelete(user: User) {
    if (!confirm(t('admin.confirmDelete'))) return;
    try {
      await adminUsers.remove(user.id);
      await load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      alert(msg || 'Failed');
    }
  }

  async function handleResetPassword() {
    if (!resetId || newPassword.length < 8) return;
    try {
      await adminUsers.resetPassword(resetId, newPassword);
      setResetId(null);
      setNewPassword('');
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
          + {t('admin.userForm.createUser')}
        </button>
      )}

      {showForm && (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-4 space-y-3">
          <h2 className="font-semibold">{creating ? t('admin.userForm.createUser') : t('admin.userForm.editUser')}</h2>
          {error && <div className="bg-red-50 text-red-700 px-4 py-2 rounded-lg text-sm mb-4">{error}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('admin.userForm.firstName')} *</label>
              <input className={inputCls} value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('admin.userForm.lastName')} *</label>
              <input className={inputCls} value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('admin.userForm.email')}</label>
              <input type="email" className={inputCls} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            {creating && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">{t('admin.userForm.password')}</label>
                <input type="password" className={inputCls} value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
              </div>
            )}
            <div>
              <label className="block text-xs text-gray-500 mb-1">{t('admin.userForm.role')}</label>
              <select className={inputCls} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as 'admin' | 'member' }))}>
                <option value="member">{t('admin.userForm.roleMember')}</option>
                <option value="admin">{t('admin.userForm.roleAdmin')}</option>
              </select>
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input type="checkbox" id="can_login" checked={form.can_login} onChange={e => setForm(f => ({ ...f, can_login: e.target.checked }))} />
              <label htmlFor="can_login" className="text-sm">{t('admin.userForm.canLogin')}</label>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={handleSave} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">{t('admin.save')}</button>
            <button onClick={cancelForm} className="border border-gray-300 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">{t('admin.cancel')}</button>
          </div>
        </div>
      )}

      {/* Password reset modal */}
      {resetId && (
        <div className="bg-white rounded-xl shadow-sm p-6 mb-4 space-y-3">
          <h2 className="font-semibold">{t('admin.userForm.resetPassword')}</h2>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('admin.userForm.newPassword')}</label>
            <input type="password" className={inputCls} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder={t('admin.userForm.minChars')} />
          </div>
          <div className="flex gap-2">
            <button onClick={handleResetPassword} disabled={newPassword.length < 8} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">{t('admin.save')}</button>
            <button onClick={() => { setResetId(null); setNewPassword(''); }} className="border border-gray-300 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">{t('admin.cancel')}</button>
          </div>
        </div>
      )}

      {/* User list */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-4 py-3">{t('admin.name')}</th>
              <th className="px-4 py-3 hidden sm:table-cell">{t('admin.userForm.email')}</th>
              <th className="px-4 py-3">{t('admin.userForm.role')}</th>
              <th className="px-4 py-3">{t('admin.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  {u.first_name} {u.last_name}
                  {!u.can_login && <span className="ml-1 text-xs text-gray-400">(no login)</span>}
                </td>
                <td className="px-4 py-3 hidden sm:table-cell text-gray-500">{u.email || '—'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${u.role === 'admin' ? 'bg-purple-50 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                    {u.role === 'admin' ? t('admin.userForm.roleAdmin') : t('admin.userForm.roleMember')}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => startEdit(u)} className="text-blue-600 hover:underline text-xs">{t('admin.edit')}</button>
                    {u.can_login && <button onClick={() => setResetId(u.id)} className="text-orange-600 hover:underline text-xs">{t('admin.userForm.resetPassword')}</button>}
                    <button onClick={() => handleDelete(u)} className="text-red-600 hover:underline text-xs">{t('admin.delete')}</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
