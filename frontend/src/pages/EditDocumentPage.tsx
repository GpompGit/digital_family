import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { getDocument, updateDocument, getCategories, getUsers, getInstitutions, getAssets } from '../services/api';
import type { Category, User, Institution, Asset } from '../types';

interface EditForm {
  title: string;
  person_id: string;
  category_id: string;
  institution_id: string;
  asset_id: string;
  document_date: string;
  expires_at: string;
  notes: string;
}

export default function EditDocumentPage() {
  const { t } = useTranslation();
  const { uuid } = useParams<{ uuid: string }>();
  const navigate = useNavigate();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<EditForm>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!uuid) return;
    Promise.all([getDocument(uuid), getCategories(), getUsers(), getInstitutions(), getAssets()])
      .then(([doc, cats, usrs, insts, asts]) => {
        setCategories(cats);
        setUsers(usrs);
        setInstitutions(insts);
        setAssets(asts);
        reset({
          title: doc.title,
          person_id: String(doc.person_id),
          category_id: String(doc.category_id),
          institution_id: doc.institution_id ? String(doc.institution_id) : '',
          asset_id: doc.asset_id ? String(doc.asset_id) : '',
          document_date: doc.document_date ? doc.document_date.split('T')[0] : '',
          expires_at: doc.expires_at ? doc.expires_at.split('T')[0] : '',
          notes: doc.notes || ''
        });
      })
      .catch(() => navigate('/'))
      .finally(() => setLoading(false));
  }, [uuid, navigate, reset]);

  async function onSubmit(data: EditForm) {
    if (!uuid) return;
    setSaving(true);
    setError('');
    try {
      await updateDocument(uuid, data);
      navigate(`/documents/${uuid}`);
    } catch {
      setError(t('editDocument.error'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-center py-12 text-gray-400">{t('common.loading')}</div>;
  }

  return (
    <div className="max-w-lg mx-auto">
      <Link to={`/documents/${uuid}`} className="text-sm text-blue-600 hover:underline mb-4 inline-block">{t('common.back')}</Link>
      <h1 className="text-xl font-bold mb-4">{t('editDocument.title')}</h1>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-2 rounded-lg text-sm mb-4">{error}</div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-xl shadow-sm p-6 space-y-4">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">{t('editDocument.titleLabel')}</label>
          <input
            id="title"
            type="text"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            {...register('title', { required: t('editDocument.titleRequired') })}
          />
          {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
        </div>

        <div>
          <label htmlFor="person_id" className="block text-sm font-medium text-gray-700 mb-1">{t('editDocument.personLabel')}</label>
          <select
            id="person_id"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            {...register('person_id', { required: t('common.required') })}
          >
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="category_id" className="block text-sm font-medium text-gray-700 mb-1">{t('editDocument.categoryLabel')}</label>
          <select
            id="category_id"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            {...register('category_id', { required: t('common.required') })}
          >
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="institution_id" className="block text-sm font-medium text-gray-700 mb-1">{t('editDocument.institutionLabel')}</label>
          <select
            id="institution_id"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            {...register('institution_id')}
          >
            <option value="">{t('common.select')}</option>
            {institutions.map(i => (
              <option key={i.id} value={i.id}>{i.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="asset_id" className="block text-sm font-medium text-gray-700 mb-1">{t('editDocument.assetLabel')}</label>
          <select
            id="asset_id"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            {...register('asset_id')}
          >
            <option value="">{t('common.select')}</option>
            {assets.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="document_date" className="block text-sm font-medium text-gray-700 mb-1">{t('editDocument.dateLabel')}</label>
          <input
            id="document_date"
            type="date"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            {...register('document_date')}
          />
        </div>

        <div>
          <label htmlFor="expires_at" className="block text-sm font-medium text-gray-700 mb-1">{t('editDocument.expiresLabel')}</label>
          <input
            id="expires_at"
            type="date"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            {...register('expires_at')}
          />
        </div>

        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">{t('editDocument.notesLabel')}</label>
          <textarea
            id="notes"
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            {...register('notes')}
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
        >
          {saving ? t('editDocument.submitting') : t('editDocument.submit')}
        </button>
      </form>
    </div>
  );
}
