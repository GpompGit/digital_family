import { useState, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { login } from '../services/api';

export default function LoginPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();

    if (!email.trim()) {
      setError(t('login.emailRequired'));
      return;
    }
    if (!password) {
      setError(t('login.passwordRequired'));
      return;
    }

    try {
      setError('');
      setSubmitting(true);
      await login(email, password);
      window.location.href = '/';
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setError(status === 429 ? t('login.lockedOut') : t('login.error'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-gray-50">
      {/* Hero image — full width on mobile, left half on desktop */}
      <div className="lg:w-1/2 lg:min-h-screen">
        <img
          src="/login-hero.png"
          alt="Digital Family — Secure PDF Storage for Your Family"
          className="w-full h-48 sm:h-64 lg:h-full object-cover"
        />
      </div>

      {/* Login form — centered on the right half */}
      <div className="flex-1 flex items-center justify-center px-4 py-8 lg:py-0">
        <div className="bg-white p-8 rounded-xl shadow-sm max-w-sm w-full">
          <h1 className="text-2xl font-bold text-center mb-2">{t('login.title')}</h1>
          <p className="text-gray-500 text-center text-sm mb-6">{t('login.subtitle')}</p>

          {error && (
            <div className="bg-red-50 text-red-700 px-4 py-2 rounded-lg text-sm mb-4">
              {error}
            </div>
          )}

          <form onSubmit={onSubmit}>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              {t('login.emailLabel')}
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={t('login.emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1 mt-4">
              {t('login.passwordLabel')}
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder={t('login.passwordPlaceholder')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <div className="flex justify-end mt-2">
              <Link to="/forgot-password" className="text-sm text-blue-600 hover:underline">
                {t('login.forgotPassword')}
              </Link>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-3 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
            >
              {submitting ? t('login.submitting') : t('login.submit')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
