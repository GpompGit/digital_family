import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { uploadDocument, getCategories, getUsers, getInstitutions, getAssets } from '../services/api';
import type { Category, User, Institution, Asset } from '../types';

interface UploadForm {
  title: string;
  person_id: string;
  category_id: string;
  institution_id: string;
  asset_id: string;
  document_date: string;
  expires_at: string;
  notes: string;
  is_encrypted: boolean;
  is_private: boolean;
}

export default function UploadPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors } } = useForm<UploadForm>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([getCategories(), getUsers(), getInstitutions(), getAssets()]).then(([cats, usrs, insts, asts]) => {
      setCategories(cats);
      setUsers(usrs);
      setInstitutions(insts);
      setAssets(asts);
    });
  }, []);

  async function onSubmit(data: UploadForm) {
    if (!file) {
      setError(t('upload.fileRequired'));
      return;
    }

    setUploading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', data.title);
      formData.append('person_id', data.person_id);
      formData.append('category_id', data.category_id);
      if (data.institution_id) formData.append('institution_id', data.institution_id);
      if (data.asset_id) formData.append('asset_id', data.asset_id);
      if (data.document_date) formData.append('document_date', data.document_date);
      if (data.expires_at) formData.append('expires_at', data.expires_at);
      if (data.notes) formData.append('notes', data.notes);
      if (data.is_encrypted) formData.append('is_encrypted', 'true');
      if (data.is_private) formData.append('is_private', 'true');

      const result = await uploadDocument(formData);
      navigate(`/documents/${result.uuid}`);
    } catch {
      setError(t('upload.error'));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-xl font-bold mb-4">{t('upload.title')}</h1>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-2 rounded-lg text-sm mb-4">{error}</div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-xl shadow-sm p-6 space-y-4">
        {/* File */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t('upload.fileLabel')}</label>
          <input
            type="file"
            accept="application/pdf"
            onChange={e => setFile(e.target.files?.[0] || null)}
            className="w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>

        {/* Title */}
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">{t('upload.titleLabel')}</label>
          <input
            id="title"
            type="text"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder={t('upload.titlePlaceholder')}
            {...register('title', { required: t('upload.titleRequired') })}
          />
          {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
        </div>

        {/* Person */}
        <div>
          <label htmlFor="person_id" className="block text-sm font-medium text-gray-700 mb-1">{t('upload.personLabel')}</label>
          <select
            id="person_id"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            {...register('person_id', { required: t('upload.personRequired') })}
          >
            <option value="">{t('common.select')}</option>
            {users.map(u => (
              <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>
            ))}
          </select>
          {errors.person_id && <p className="text-red-500 text-xs mt-1">{errors.person_id.message}</p>}
        </div>

        {/* Category */}
        <div>
          <label htmlFor="category_id" className="block text-sm font-medium text-gray-700 mb-1">{t('upload.categoryLabel')}</label>
          <select
            id="category_id"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            {...register('category_id', { required: t('upload.categoryRequired') })}
          >
            <option value="">{t('common.select')}</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {errors.category_id && <p className="text-red-500 text-xs mt-1">{errors.category_id.message}</p>}
        </div>

        {/* Institution */}
        <div>
          <label htmlFor="institution_id" className="block text-sm font-medium text-gray-700 mb-1">{t('upload.institutionLabel')}</label>
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

        {/* Asset (optional) */}
        <div>
          <label htmlFor="asset_id" className="block text-sm font-medium text-gray-700 mb-1">{t('upload.assetLabel')}</label>
          <select
            id="asset_id"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            {...register('asset_id')}
          >
            <option value="">{t('common.select')}</option>
            {assets.map(a => (
              <option key={a.id} value={a.id}>{a.name} ({t(`assets.types.${a.asset_type}`)})</option>
            ))}
          </select>
        </div>

        {/* Document Date */}
        <div>
          <label htmlFor="document_date" className="block text-sm font-medium text-gray-700 mb-1">{t('upload.dateLabel')}</label>
          <input
            id="document_date"
            type="date"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            {...register('document_date')}
          />
        </div>

        {/* Expiry Date */}
        <div>
          <label htmlFor="expires_at" className="block text-sm font-medium text-gray-700 mb-1">{t('upload.expiresLabel')}</label>
          <input
            id="expires_at"
            type="date"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            {...register('expires_at')}
          />
        </div>

        {/* Notes */}
        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">{t('upload.notesLabel')}</label>
          <textarea
            id="notes"
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            placeholder={t('upload.notesPlaceholder')}
            {...register('notes')}
          />
        </div>

        {/* Security toggles */}
        <div className="flex flex-col gap-2 border-t border-gray-100 pt-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" {...register('is_encrypted')} className="rounded border-gray-300" />
            <span className="text-gray-700">{t('upload.encryptLabel')}</span>
            <span className="text-xs text-gray-400">{t('upload.encryptHint')}</span>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" {...register('is_private')} className="rounded border-gray-300" />
            <span className="text-gray-700">{t('upload.privateLabel')}</span>
            <span className="text-xs text-gray-400">{t('upload.privateHint')}</span>
          </label>
        </div>

        <button
          type="submit"
          disabled={uploading}
          className="w-full bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
        >
          {uploading ? t('upload.submitting') : t('upload.submit')}
        </button>
      </form>
    </div>
  );
}
