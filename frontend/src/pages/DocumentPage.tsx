import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Document as PdfDocument, Page } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { useAuth } from '../context/AuthContext';
import { getDocument, deleteDocument, getFileUrl } from '../services/api';
import { SkeletonDocumentDetail } from '../components/Skeleton';
import type { Document } from '../types';

export default function DocumentPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
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

  const canDelete = doc && user && (doc.user_id === user.id || user.role === 'admin');

  async function handleDelete() {
    if (!uuid || !confirm(t('document.deleteConfirm'))) return;
    setDeleting(true);
    try {
      await deleteDocument(uuid);
      navigate('/');
    } catch {
      alert(t('document.deleteError'));
      setDeleting(false);
    }
  }

  const handlePrint = useCallback(() => {
    if (!doc) return;
    const url = getFileUrl(doc.uuid);
    const printWindow = window.open(url, '_blank');
    if (printWindow) {
      printWindow.addEventListener('load', () => {
        printWindow.print();
      });
    }
  }, [doc]);

  const handleShare = useCallback(async () => {
    if (!doc) return;
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({
          title: t('document.shareTitle', { title: doc.title }),
          text: `${doc.title} — ${doc.category_name}`,
          url,
        });
      } catch {
        // user cancelled share — ignore
      }
    } else {
      // Fallback: copy URL to clipboard
      try {
        await navigator.clipboard.writeText(url);
        alert(t('document.shareNotSupported'));
      } catch {
        alert(t('document.shareNotSupported'));
      }
    }
  }, [doc, t]);

  function formatDate(dateStr: string | null) {
    if (!dateStr) return t('common.dash');
    return new Date(dateStr).toLocaleDateString();
  }

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (loading) {
    return <SkeletonDocumentDetail />;
  }

  if (!doc) {
    return <div className="text-center py-12 text-gray-400">{t('document.notFound')}</div>;
  }

  const fileUrl = getFileUrl(doc.uuid);

  return (
    <div className="max-w-lg mx-auto">
      <Link to="/" className="text-sm text-blue-600 hover:underline mb-4 inline-block">{t('common.back')}</Link>

      <div className="bg-white rounded-xl shadow-sm p-6">
        {/* PDF Preview — first page thumbnail */}
        <div className="mb-5 flex justify-center">
          <div className="border border-gray-200 rounded-lg overflow-hidden shadow-sm bg-gray-50">
            <PdfDocument
              file={fileUrl}
              loading={<div className="w-[280px] h-[360px] flex items-center justify-center text-gray-400 text-sm">{t('common.loading')}</div>}
              error={<div className="w-[280px] h-[100px] flex items-center justify-center text-gray-400 text-xs">PDF preview unavailable</div>}
            >
              <Page pageNumber={1} width={280} renderAnnotationLayer={false} renderTextLayer={false} />
            </PdfDocument>
          </div>
        </div>

        {/* Title and category */}
        <h1 className="text-xl font-bold mb-1">{doc.title}</h1>
        <span className="inline-flex items-center bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full text-xs mb-4">
          {doc.category_name}
        </span>

        {/* Metadata */}
        <dl className="space-y-3 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-500">{t('document.person')}</dt>
            <dd className="font-medium">{doc.person_first_name} {doc.person_last_name}</dd>
          </div>
          {doc.institution_name && (
            <div className="flex justify-between">
              <dt className="text-gray-500">{t('document.institution')}</dt>
              <dd className="font-medium">{doc.institution_name}</dd>
            </div>
          )}
          {doc.asset_name && (
            <div className="flex justify-between">
              <dt className="text-gray-500">{t('document.asset')}</dt>
              <dd className="font-medium">{doc.asset_name}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-gray-500">{t('document.documentDate')}</dt>
            <dd className="font-medium">{formatDate(doc.document_date)}</dd>
          </div>
          {doc.expires_at && (
            <div className="flex justify-between">
              <dt className="text-gray-500">{t('document.expiryDate')}</dt>
              <dd className="font-medium">{formatDate(doc.expires_at)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-gray-500">{t('document.file')}</dt>
            <dd className="font-medium">{doc.original_filename} ({formatSize(doc.file_size)})</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">{t('document.uploadedBy')}</dt>
            <dd className="font-medium">{doc.uploaded_by_first} {doc.uploaded_by_last}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">{t('document.added')}</dt>
            <dd className="font-medium">{formatDate(doc.created_at)}</dd>
          </div>
          {doc.version > 1 && (
            <div className="flex justify-between">
              <dt className="text-gray-500">{t('document.version')}</dt>
              <dd className="font-medium">{doc.version}</dd>
            </div>
          )}
          {doc.notes && (
            <div>
              <dt className="text-gray-500 mb-1">{t('document.notes')}</dt>
              <dd className="text-gray-700 bg-gray-50 p-3 rounded-lg">{doc.notes}</dd>
            </div>
          )}
        </dl>

        {/* Actions */}
        <div className="mt-6 space-y-2">
          {/* Primary: View PDF */}
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 font-medium"
          >
            {t('document.viewPdf')}
          </a>

          {/* Secondary actions in a 2-column grid */}
          <div className="grid grid-cols-2 gap-2">
            <a
              href={fileUrl}
              download={doc.original_filename}
              className="text-center border border-gray-300 text-gray-700 py-2.5 rounded-lg hover:bg-gray-50 font-medium text-sm"
            >
              {t('document.download')}
            </a>
            <button
              onClick={handlePrint}
              className="text-center border border-gray-300 text-gray-700 py-2.5 rounded-lg hover:bg-gray-50 font-medium text-sm"
            >
              {t('document.print')}
            </button>
            <button
              onClick={handleShare}
              className="text-center border border-gray-300 text-gray-700 py-2.5 rounded-lg hover:bg-gray-50 font-medium text-sm"
            >
              {t('document.share')}
            </button>
            <Link
              to={`/documents/${doc.uuid}/edit`}
              className="text-center border border-gray-300 text-gray-700 py-2.5 rounded-lg hover:bg-gray-50 font-medium text-sm"
            >
              {t('document.edit')}
            </Link>
          </div>

          {/* Delete — only visible to uploader or admin */}
          {canDelete && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="w-full text-center border border-red-300 text-red-600 py-2.5 rounded-lg hover:bg-red-50 font-medium disabled:opacity-50"
            >
              {deleting ? t('document.deleting') : t('document.delete')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
