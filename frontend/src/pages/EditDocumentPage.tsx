import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { getDocument, updateDocument, getCategories, getUsers, getInstitutions, createInstitution, getAssets, getTags } from '../services/api';
import type { Category, User, Institution, Asset, Tag } from '../types';

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

const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

export default function EditDocumentPage() {
  const { t } = useTranslation();
  const { uuid } = useParams<{ uuid: string }>();
  const navigate = useNavigate();
  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<EditForm>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [institutions, setInstitutions] = useState<Institution[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [invoiceFields, setInvoiceFields] = useState({ amount: '', currency: 'CHF', invoice_number: '', paid_date: '', payment_method: '' });
  const [isEncrypted, setIsEncrypted] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [newInstitution, setNewInstitution] = useState('');
  const [creatingInstitution, setCreatingInstitution] = useState(false);

  const selectedCategoryId = watch('category_id');
  const isInvoice = categories.find(c => c.id === parseInt(selectedCategoryId))?.slug === 'invoices';

  useEffect(() => {
    if (!uuid) return;
    Promise.all([getDocument(uuid), getCategories(), getUsers(), getInstitutions(), getAssets(), getTags()])
      .then(([doc, cats, usrs, insts, asts, tgs]) => {
        setCategories(cats);
        setUsers(usrs);
        setInstitutions(insts);
        setAssets(asts);
        setTags(tgs);
        if (doc.tags) {
          setSelectedTags(doc.tags.map((tag: Tag) => tag.id));
        }
        setIsEncrypted(!!doc.is_encrypted);
        setIsPrivate(!!doc.is_private);
        // Load existing custom fields into invoice fields
        if (doc.custom_fields) {
          const cf: Record<string, string> = {};
          for (const field of doc.custom_fields) {
            if (field.field_slug === 'amount' && field.value_decimal != null) cf.amount = String(field.value_decimal);
            if (field.field_slug === 'currency' && field.value_string) cf.currency = field.value_string;
            if (field.field_slug === 'invoice-number' && field.value_string) cf.invoice_number = field.value_string;
            if (field.field_slug === 'paid-date' && field.value_date) cf.paid_date = field.value_date.split('T')[0];
            if (field.field_slug === 'payment-method' && field.value_string) cf.payment_method = field.value_string;
          }
          setInvoiceFields(prev => ({ ...prev, ...cf }));
        }
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
      // Build custom fields for invoices
      const custom_fields: Record<string, string | number> = {};
      if (isInvoice) {
        if (invoiceFields.amount) custom_fields['amount'] = parseFloat(invoiceFields.amount);
        if (invoiceFields.currency) custom_fields['currency'] = invoiceFields.currency;
        if (invoiceFields.invoice_number) custom_fields['invoice-number'] = invoiceFields.invoice_number;
        if (invoiceFields.paid_date) custom_fields['paid-date'] = invoiceFields.paid_date;
        if (invoiceFields.payment_method) custom_fields['payment-method'] = invoiceFields.payment_method;
      }

      await updateDocument(uuid, {
        ...data,
        tag_ids: selectedTags,
        is_encrypted: isEncrypted,
        is_private: isPrivate,
        custom_fields: Object.keys(custom_fields).length > 0 ? custom_fields : undefined
      } as unknown as Record<string, unknown>);
      toast.success(t('toast.documentUpdated'));
      navigate(`/documents/${uuid}`);
    } catch {
      toast.error(t('editDocument.error'));
    } finally {
      setSaving(false);
    }
  }

  function toggleTag(tagId: number) {
    setSelectedTags(prev => prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]);
  }

  if (loading) {
    return (
      <div className="max-w-lg mx-auto space-y-4">
        <div className="w-16 h-4 bg-gray-200 rounded animate-pulse" />
        <div className="w-48 h-6 bg-gray-200 rounded animate-pulse" />
        <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i}>
              <div className="w-24 h-3 bg-gray-200 rounded animate-pulse mb-2" />
              <div className="w-full h-10 bg-gray-200 rounded animate-pulse" />
            </div>
          ))}
          <div className="w-full h-10 bg-gray-200 rounded animate-pulse" />
        </div>
      </div>
    );
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
          <input id="title" type="text" className={inputCls} {...register('title', { required: t('editDocument.titleRequired') })} />
          {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
        </div>

        <div>
          <label htmlFor="person_id" className="block text-sm font-medium text-gray-700 mb-1">{t('editDocument.personLabel')}</label>
          <select id="person_id" className={inputCls} {...register('person_id', { required: t('common.required') })}>
            {users.map(u => <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="category_id" className="block text-sm font-medium text-gray-700 mb-1">{t('editDocument.categoryLabel')}</label>
          <select id="category_id" className={inputCls} {...register('category_id', { required: t('common.required') })}>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="institution_id" className="block text-sm font-medium text-gray-700 mb-1">{t('editDocument.institutionLabel')}</label>
          <select id="institution_id" className={inputCls} {...register('institution_id')}>
            <option value="">{t('common.select')}</option>
            {institutions.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
          {!creatingInstitution ? (
            <button type="button" onClick={() => setCreatingInstitution(true)} className="text-blue-600 text-xs hover:underline mt-1">
              + {t('upload.newInstitution')}
            </button>
          ) : (
            <div className="flex gap-2 mt-2">
              <input type="text" className={`flex-1 ${inputCls}`} placeholder={t('upload.newInstitutionPlaceholder')}
                value={newInstitution} onChange={e => setNewInstitution(e.target.value)} />
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

        <div>
          <label htmlFor="asset_id" className="block text-sm font-medium text-gray-700 mb-1">{t('editDocument.assetLabel')}</label>
          <select id="asset_id" className={inputCls} {...register('asset_id')}>
            <option value="">{t('common.select')}</option>
            {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>

        <div>
          <label htmlFor="document_date" className="block text-sm font-medium text-gray-700 mb-1">{t('editDocument.dateLabel')}</label>
          <input id="document_date" type="date" className={inputCls} {...register('document_date')} />
        </div>

        <div>
          <label htmlFor="expires_at" className="block text-sm font-medium text-gray-700 mb-1">{t('editDocument.expiresLabel')}</label>
          <input id="expires_at" type="date" className={inputCls} {...register('expires_at')} />
        </div>

        {/* Invoice-specific fields (shown when category = Invoices) */}
        {isInvoice && (
          <div className="border-t border-gray-100 pt-4 space-y-3">
            <h3 className="text-sm font-medium text-gray-700">{t('invoice.title')}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('invoice.amount')}</label>
                <input type="number" step="0.01" className={inputCls} value={invoiceFields.amount}
                  onChange={e => setInvoiceFields(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('invoice.currency')}</label>
                <select className={inputCls} value={invoiceFields.currency}
                  onChange={e => setInvoiceFields(f => ({ ...f, currency: e.target.value }))}>
                  <option value="CHF">CHF</option>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('invoice.invoiceNumber')}</label>
              <input type="text" className={inputCls} value={invoiceFields.invoice_number}
                onChange={e => setInvoiceFields(f => ({ ...f, invoice_number: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('invoice.paidDate')}</label>
                <input type="date" className={inputCls} value={invoiceFields.paid_date}
                  onChange={e => setInvoiceFields(f => ({ ...f, paid_date: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('invoice.paymentMethod')}</label>
                <select className={inputCls} value={invoiceFields.payment_method}
                  onChange={e => setInvoiceFields(f => ({ ...f, payment_method: e.target.value }))}>
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

        {/* Tags */}
        {tags.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('document.tags')}</label>
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${selectedTags.includes(tag.id) ? 'text-white border-transparent' : 'text-gray-600 border-gray-300 bg-white hover:bg-gray-50'}`}
                  style={selectedTags.includes(tag.id) ? { backgroundColor: tag.color } : undefined}
                >
                  {tag.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">{t('editDocument.notesLabel')}</label>
          <textarea id="notes" rows={3} className={`${inputCls} resize-none`} {...register('notes')} />
        </div>

        {/* Security toggles */}
        <div className="flex flex-col gap-2 border-t border-gray-100 pt-4">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={isEncrypted} onChange={e => setIsEncrypted(e.target.checked)} className="rounded border-gray-300" />
            <span className="text-gray-700">{t('upload.encryptLabel')}</span>
            <span className="text-xs text-gray-400">{t('upload.encryptHint')}</span>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={isPrivate} onChange={e => setIsPrivate(e.target.checked)} className="rounded border-gray-300" />
            <span className="text-gray-700">{t('upload.privateLabel')}</span>
            <span className="text-xs text-gray-400">{t('upload.privateHint')}</span>
          </label>
        </div>

        <button type="submit" disabled={saving} className="w-full bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50">
          {saving ? t('editDocument.submitting') : t('editDocument.submit')}
        </button>
      </form>
    </div>
  );
}
