import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { resetPassword } from '../services/api';

interface ResetPasswordForm {
  password: string;
  confirmPassword: string;
}

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { register, handleSubmit, watch, formState: { errors } } = useForm<ResetPasswordForm>();
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(data: ResetPasswordForm) {
    if (!token) return;

    try {
      setError('');
      setSubmitting(true);
      await resetPassword(token, data.password);
      setSuccess(true);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(message || t('resetPassword.error'));
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white p-8 rounded-xl shadow-sm max-w-sm w-full text-center">
          <p className="text-red-600 mb-4">{t('resetPassword.invalidLink')}</p>
          <Link to="/forgot-password" className="text-blue-600 hover:underline text-sm">
            {t('resetPassword.requestNew')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white p-8 rounded-xl shadow-sm max-w-sm w-full">
        <h1 className="text-2xl font-bold text-center mb-2">{t('resetPassword.title')}</h1>
        <p className="text-gray-500 text-center text-sm mb-6">{t('resetPassword.subtitle')}</p>

        {success ? (
          <div>
            <div className="bg-green-50 text-green-700 px-4 py-3 rounded-lg text-sm mb-4">
              {t('resetPassword.success')}
            </div>
            <Link
              to="/login"
              className="block text-center w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-medium"
            >
              {t('resetPassword.goToLogin')}
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
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                {t('resetPassword.passwordLabel')}
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={t('resetPassword.passwordPlaceholder')}
                {...register('password', {
                  required: t('login.passwordRequired'),
                  minLength: { value: 8, message: t('resetPassword.minLength') },
                  pattern: {
                    value: /^(?=.*[a-zA-Z])(?=.*[0-9])/,
                    message: t('resetPassword.complexity')
                  }
                })}
              />
              {errors.password && (
                <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>
              )}

              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1 mt-4">
                {t('resetPassword.confirmLabel')}
              </label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder={t('resetPassword.confirmPlaceholder')}
                {...register('confirmPassword', {
                  required: t('resetPassword.confirmRequired'),
                  validate: (val) => val === watch('password') || t('resetPassword.mismatch')
                })}
              />
              {errors.confirmPassword && (
                <p className="text-red-500 text-xs mt-1">{errors.confirmPassword.message}</p>
              )}

              <p className="text-gray-400 text-xs mt-2">{t('resetPassword.hint')}</p>

              <button
                type="submit"
                disabled={submitting}
                className="w-full mt-4 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50"
              >
                {submitting ? t('resetPassword.submitting') : t('resetPassword.submit')}
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
