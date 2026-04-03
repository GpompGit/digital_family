import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../services/api';

interface ForgotPasswordForm {
  email: string;
}

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const { register, handleSubmit, formState: { errors } } = useForm<ForgotPasswordForm>();
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(data: ForgotPasswordForm) {
    try {
      setError('');
      setSubmitting(true);
      await forgotPassword(data.email);
      setSent(true);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setError(status === 429 ? t('forgotPassword.rateLimited') : t('forgotPassword.error'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white p-8 rounded-xl shadow-sm max-w-sm w-full">
        <h1 className="text-2xl font-bold text-center mb-2">{t('forgotPassword.title')}</h1>
        <p className="text-gray-500 text-center text-sm mb-6">{t('forgotPassword.subtitle')}</p>

        {sent ? (
          <div>
            <div className="bg-green-50 text-green-700 px-4 py-3 rounded-lg text-sm mb-4">
              {t('forgotPassword.sent')}
            </div>
            <Link
              to="/login"
              className="block text-center text-sm text-blue-600 hover:underline"
            >
              {t('forgotPassword.backToLogin')}
            </Link>
          </div>
        ) : (
          <>
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

              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-4 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
              >
                {submitting ? t('forgotPassword.submitting') : t('forgotPassword.submit')}
              </button>
            </form>

            <Link
              to="/login"
              className="block text-center text-sm text-blue-600 hover:underline mt-4"
            >
              {t('forgotPassword.backToLogin')}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
