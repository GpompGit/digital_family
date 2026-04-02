import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { login } from '../services/api';

interface LoginForm {
  email: string;
  password: string;
}

export default function LoginPage() {
  const { t } = useTranslation();
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(data: LoginForm) {
    try {
      setError('');
      setSubmitting(true);
      await login(data.email, data.password);
      window.location.href = '/';
    } catch {
      setError(t('login.error'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white p-8 rounded-xl shadow-sm max-w-sm w-full">
        <h1 className="text-2xl font-bold text-center mb-2">{t('login.title')}</h1>
        <p className="text-gray-500 text-center text-sm mb-6">{t('login.subtitle')}</p>

        {error && (
          <div className="bg-red-50 text-red-700 px-4 py-2 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)}>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            {t('login.emailLabel')}
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder={t('login.emailPlaceholder')}
            {...register('email', { required: t('login.emailRequired') })}
          />
          {errors.email && (
            <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>
          )}

          <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1 mt-4">
            {t('login.passwordLabel')}
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder={t('login.passwordPlaceholder')}
            {...register('password', { required: t('login.passwordRequired') })}
          />
          {errors.password && (
            <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-4 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
          >
            {submitting ? t('login.submitting') : t('login.submit')}
          </button>
        </form>
      </div>
    </div>
  );
}
