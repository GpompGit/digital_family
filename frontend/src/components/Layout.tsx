import { Outlet, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

const LANGUAGES = [
  { code: 'en', label: 'EN' },
  { code: 'de', label: 'DE' },
  { code: 'es', label: 'ES' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { t, i18n } = useTranslation();

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/" className="text-lg font-bold text-blue-600">
            {t('common.appName')}
          </Link>
          <div className="flex items-center gap-3">
            {/* Language switcher */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
              {LANGUAGES.map(lang => (
                <button
                  key={lang.code}
                  onClick={() => i18n.changeLanguage(lang.code)}
                  className={`px-2 py-1 ${
                    i18n.resolvedLanguage === lang.code
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>
            {user && (
              <>
                <Link to="/upload" className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700">
                  {t('nav.upload')}
                </Link>
                {user.role === 'admin' && (
                  <Link to="/settings" className="text-sm text-gray-600 hover:text-gray-900">
                    {t('nav.settings')}
                  </Link>
                )}
                <Link to="/profile" className="text-sm text-gray-600 hover:text-gray-900">
                  {t('nav.profile')}
                </Link>
                <button onClick={logout} className="text-sm text-gray-500 hover:text-gray-700">
                  {t('nav.logout')}
                </button>
              </>
            )}
          </div>
        </div>
      </nav>
      <main className="max-w-5xl mx-auto px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
