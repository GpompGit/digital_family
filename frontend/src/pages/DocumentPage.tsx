import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getDocument, deleteDocument, getFileUrl } from '../services/api';
import type { Document } from '../types';

export default function DocumentPage() {
  const { uuid } = useParams<{ uuid: string }>();
  const navigate = useNavigate();
  const [doc, setDoc] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!uuid) return;
    getDocument(uuid)
      .then(setDoc)
      .catch(() => navigate('/'))
      .finally(() => setLoading(false));
  }, [uuid, navigate]);

  async function handleDelete() {
    if (!uuid || !confirm('Delete this document? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await deleteDocument(uuid);
      navigate('/');
    } catch {
      alert('Failed to delete document');
      setDeleting(false);
    }
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('de-CH');
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (loading) {
    return <div className="text-center py-12 text-gray-400">Loading...</div>;
  }

  if (!doc) {
    return <div className="text-center py-12 text-gray-400">Document not found</div>;
  }

  const fileUrl = getFileUrl(doc.uuid);

  return (
    <div className="max-w-lg mx-auto">
      <Link to="/" className="text-sm text-blue-600 hover:underline mb-4 inline-block">&larr; Back</Link>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <h1 className="text-xl font-bold mb-1">{doc.title}</h1>
        <span className="inline-flex items-center bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-xs mb-4">
          {doc.category_name}
        </span>

        <dl className="space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-500">Person</dt>
            <dd className="font-medium">{doc.person_name}</dd>
          </div>
          {doc.institution && (
            <div className="flex justify-between">
              <dt className="text-gray-500">Institution</dt>
              <dd className="font-medium">{doc.institution}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-gray-500">Document date</dt>
            <dd className="font-medium">{formatDate(doc.document_date)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">File</dt>
            <dd className="font-medium">{doc.original_filename} ({formatSize(doc.file_size)})</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Uploaded by</dt>
            <dd className="font-medium">{doc.uploaded_by_first} {doc.uploaded_by_last}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Added</dt>
            <dd className="font-medium">{formatDate(doc.created_at)}</dd>
          </div>
          {doc.notes && (
            <div>
              <dt className="text-gray-500 mb-1">Notes</dt>
              <dd className="text-gray-700 bg-gray-50 p-3 rounded-lg">{doc.notes}</dd>
            </div>
          )}
        </dl>

        {/* Actions */}
        <div className="mt-6 space-y-2">
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 font-medium"
          >
            View PDF
          </a>
          <a
            href={fileUrl}
            download={doc.original_filename}
            className="block w-full text-center border border-gray-300 text-gray-700 py-2.5 rounded-lg hover:bg-gray-50 font-medium"
          >
            Download
          </a>
          <Link
            to={`/documents/${doc.uuid}/edit`}
            className="block w-full text-center border border-gray-300 text-gray-700 py-2.5 rounded-lg hover:bg-gray-50 font-medium"
          >
            Edit
          </Link>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="w-full text-center border border-red-300 text-red-600 py-2.5 rounded-lg hover:bg-red-50 font-medium disabled:opacity-50"
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
