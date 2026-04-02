import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import UploadPage from './pages/UploadPage';
import DocumentPage from './pages/DocumentPage';
import EditDocumentPage from './pages/EditDocumentPage';
import SettingsLayout from './pages/admin/SettingsLayout';
import UsersPage from './pages/admin/UsersPage';
import MetadataPage from './pages/admin/MetadataPage';
import AuditLogPage from './pages/admin/AuditLogPage';
import type { ReactNode } from 'react';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const { t } = useTranslation();
  if (loading) return <div className="text-center py-12 text-gray-400">{t('common.loading')}</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const { t } = useTranslation();
  if (loading) return <div className="text-center py-12 text-gray-400">{t('common.loading')}</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const { t } = useTranslation();
  if (loading) return <div className="text-center py-12 text-gray-400">{t('common.loading')}</div>;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function CategoriesPage() {
  const { t } = useTranslation();
  return <MetadataPage apiPath="/api/admin/categories" titleKey="admin.categories" fields={[
    { key: 'name', label: t('admin.name') },
    { key: 'slug', label: t('admin.slug') },
  ]} />;
}

function InstitutionsPage() {
  const { t } = useTranslation();
  return <MetadataPage apiPath="/api/admin/institutions" titleKey="admin.institutions" fields={[
    { key: 'name', label: t('admin.name') },
    { key: 'slug', label: t('admin.slug') },
  ]} />;
}

function TagsPage() {
  const { t } = useTranslation();
  return <MetadataPage apiPath="/api/admin/tags" titleKey="admin.tags" fields={[
    { key: 'name', label: t('admin.name') },
    { key: 'slug', label: t('admin.slug') },
    { key: 'color', label: t('admin.color'), type: 'color', required: false },
  ]} />;
}

function CustomFieldsPage() {
  const { t } = useTranslation();
  return <MetadataPage apiPath="/api/admin/custom-fields" titleKey="admin.customFields" fields={[
    { key: 'name', label: t('admin.name') },
    { key: 'slug', label: t('admin.slug') },
    { key: 'data_type', label: t('admin.dataType'), type: 'select', options: [
      { value: 'string', label: 'String' },
      { value: 'date', label: 'Date' },
      { value: 'integer', label: 'Integer' },
      { value: 'boolean', label: 'Boolean' },
      { value: 'monetary', label: 'Monetary' },
      { value: 'url', label: 'URL' },
    ]},
  ]} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<DashboardPage />} />
            <Route path="upload" element={<UploadPage />} />
            <Route path="documents/:uuid" element={<DocumentPage />} />
            <Route path="documents/:uuid/edit" element={<EditDocumentPage />} />
          </Route>
          <Route element={<AdminRoute><Layout /></AdminRoute>}>
            <Route path="settings" element={<SettingsLayout />}>
              <Route index element={<Navigate to="users" replace />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="categories" element={<CategoriesPage />} />
              <Route path="institutions" element={<InstitutionsPage />} />
              <Route path="tags" element={<TagsPage />} />
              <Route path="custom-fields" element={<CustomFieldsPage />} />
              <Route path="audit" element={<AuditLogPage />} />
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
