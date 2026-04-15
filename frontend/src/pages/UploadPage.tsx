import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { uploadDocument, getCategories, getUsers, getInstitutions, createInstitution, getAssets, getTags } from '../services/api';
import type { Category, User, Institution, Asset, Tag } from '../types';

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
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<UploadForm>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [newInstitution, setNewInstitution] = useState('');
  const [creatingInstitution, setCreatingInstitution] = useState(false);

  // Invoice-specific fields (shown when category = "invoices")
  const [invoiceFields, setInvoiceFields] = useState({ amount: '', currency: 'CHF', invoice_number: '', paid_date: '', payment_method: '' });
  const selectedCategoryId = watch('category_id');
  const isInvoice = categories.find(c => c.id === parseInt(selectedCategoryId))?.slug === 'invoices';

  useEffect(() => {
    Promise.all([getCategories(), getUsers(), getInstitutions(), getAssets(), getTags()]).then(([cats, usrs, insts, asts, tgs]) => {
      setCategories(cats);
      setUsers(usrs);
      setInstitutions(insts);
      setAssets(asts);
      setTags(tgs);
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
      if (selectedTags.length > 0) formData.append('tag_ids', JSON.stringify(selectedTags));

      // Append invoice custom fields if category is Invoices
      if (isInvoice) {
        const cf: Record<string, string | number> = {};
        if (invoiceFields.amount) cf['amount'] = parseFloat(invoiceFields.amount);
        if (invoiceFields.currency) cf['currency'] = invoiceFields.currency;
        if (invoiceFields.invoice_number) cf['invoice-number'] = invoiceFields.invoice_number;
        if (invoiceFields.paid_date) cf['paid-date'] = invoiceFields.paid_date;
        if (invoiceFields.payment_method) cf['payment-method'] = invoiceFields.payment_method;
        if (Object.keys(cf).length > 0) formData.append('custom_fields', JSON.stringify(cf));
      }

      const result = await uploadDocument(formData);
      toast.success(t('toast.documentUploaded'));
      navigate(`/documents/${result.uuid}`);
    } catch {
      toast.error(t('upload.error'));
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
            {institutions.map(i => (
              <option key={i.id} value={i.id}>{i.name}</option>
            ))}
          </select>
          {!creatingInstitution ? (
            <button type="button" onClick={() => setCreatingInstitution(true)} className="text-blue-600 text-xs hover:underline mt-1">
              + {t('upload.newInstitution')}
            </button>
          ) : (
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={t('upload.newInstitutionPlaceholder')}
                value={newInstitution}
                onChange={e => setNewInstitution(e.target.value)}
              />
              <button type="button" className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-blue-700" onClick={async () => {
                if (!newInstitution.trim()) return;
                const inst = await createInstitution(newInstitution.trim());
                setInstitutions(prev => {
                  const exists = prev.find(i => i.id === inst.id);
                  return exists ? prev : [...prev, inst].sort((a, b) => a.name.localeCompare(b.name));
                });
                setValue('institution_id', String(inst.id));
                setNewInstitution('');
                setCreatingInstitution(false);
                toast.success(t('toast.created'));
              }}>{t('admin.save')}</button>
              <button type="button" className="border border-gray-300 px-3 py-2 rounded-lg text-sm hover:bg-gray-50" onClick={() => { setCreatingInstitution(false); setNewInstitution(''); }}>{t('admin.cancel')}</button>
            </div>
          )}
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

        {/* Tags */}
        {tags.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('document.tags')}</label>
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => setSelectedTags(prev => prev.includes(tag.id) ? prev.filter(id => id !== tag.id) : [...prev, tag.id])}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${selectedTags.includes(tag.id) ? 'text-white border-transparent' : 'text-gray-600 border-gray-300 bg-white hover:bg-gray-50'}`}
                  style={selectedTags.includes(tag.id) ? { backgroundColor: tag.color } : undefined}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          </div>
        )}

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

        {/* Invoice-specific fields (shown when category = Invoices) */}
        {isInvoice && (
          <div className="border-t border-gray-100 pt-4 space-y-3">
            <h3 className="text-sm font-medium text-gray-700">{t('invoice.title')}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('invoice.amount')}</label>
                <input type="number" step="0.01" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={invoiceFields.amount} onChange={e => setInvoiceFields(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('invoice.currency')}</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={invoiceFields.currency} onChange={e => setInvoiceFields(f => ({ ...f, currency: e.target.value }))}>
                  <option value="CHF">CHF</option>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('invoice.invoiceNumber')}</label>
              <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={invoiceFields.invoice_number} onChange={e => setInvoiceFields(f => ({ ...f, invoice_number: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('invoice.paidDate')}</label>
                <input type="date" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={invoiceFields.paid_date} onChange={e => setInvoiceFields(f => ({ ...f, paid_date: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('invoice.paymentMethod')}</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={invoiceFields.payment_method} onChange={e => setInvoiceFields(f => ({ ...f, payment_method: e.target.value }))}>
                  <option value="">{t('common.select')}</option>
                  <option value="bank_transfer">{t('invoice.bankTransfer')}</option>
                  <option value="credit_card">{t('invoice.creditCard')}</option>
                  <option value="cash">{t('invoice.cash')}</option>
                  <option value="paypal">{t('invoice.paypal')}</option>
                  <option value="other">{t('invoice.other')}</option>
                </select>
              </div>
            </div>
          </div>
        )}

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
