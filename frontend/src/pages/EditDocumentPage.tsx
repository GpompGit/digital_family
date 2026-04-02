import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { getDocument, updateDocument, getCategories, getUsers } from '../services/api';
import type { Category, User } from '../types';

interface EditForm {
  title: string;
  person_name: string;
  category_id: string;
  institution: string;
  document_date: string;
  notes: string;
}

export default function EditDocumentPage() {
  const { uuid } = useParams<{ uuid: string }>();
  const navigate = useNavigate();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<EditForm>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!uuid) return;
    Promise.all([getDocument(uuid), getCategories(), getUsers()])
      .then(([doc, cats, usrs]) => {
        setCategories(cats);
        setUsers(usrs);
        reset({
          title: doc.title,
          person_name: doc.person_name,
          category_id: String(doc.category_id),
          institution: doc.institution || '',
          document_date: doc.document_date ? doc.document_date.split('T')[0] : '',
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
      setError('Failed to save changes');
    } finally {
      setSaving(false);
    }
  }

  const personNames = users.map(u => `${u.first_name} ${u.last_name}`);

  if (loading) {
    return <div className="text-center py-12 text-gray-400">Loading...</div>;
  }

  return (
    <div className="max-w-lg mx-auto">
      <Link to={`/documents/${uuid}`} className="text-sm text-blue-600 hover:underline mb-4 inline-block">&larr; Back</Link>
      <h1 className="text-xl font-bold mb-4">Edit Document</h1>

      {error && (
        <div className="bg-red-50 text-red-700 px-4 py-2 rounded-lg text-sm mb-4">{error}</div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-xl shadow-sm p-6 space-y-4">
        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
          <input
            id="title"
            type="text"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            {...register('title', { required: 'Title is required' })}
          />
          {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
        </div>

        <div>
          <label htmlFor="person_name" className="block text-sm font-medium text-gray-700 mb-1">Family member *</label>
          <select
            id="person_name"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            {...register('person_name', { required: 'Required' })}
          >
            {personNames.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="category_id" className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
          <select
            id="category_id"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            {...register('category_id', { required: 'Required' })}
          >
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="institution" className="block text-sm font-medium text-gray-700 mb-1">Institution</label>
          <input
            id="institution"
            type="text"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            {...register('institution')}
          />
        </div>

        <div>
          <label htmlFor="document_date" className="block text-sm font-medium text-gray-700 mb-1">Document date</label>
          <input
            id="document_date"
            type="date"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            {...register('document_date')}
          />
        </div>

        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
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
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>
    </div>
  );
}
