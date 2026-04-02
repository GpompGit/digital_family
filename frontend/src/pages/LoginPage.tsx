import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { login } from '../services/api';

interface LoginForm {
  email: string;
}

export default function LoginPage() {
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>();
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(data: LoginForm) {
    try {
      setError('');
      await login(data.email);
      setSent(true);
    } catch {
      setError('Failed to send login link. Please try again.');
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white p-8 rounded-xl shadow-sm max-w-sm w-full text-center">
          <div className="text-4xl mb-4">📧</div>
          <h2 className="text-xl font-semibold mb-2">Check your email</h2>
          <p className="text-gray-600 text-sm">
            We sent a login link to your email. Click it to sign in. The link expires in 15 minutes.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white p-8 rounded-xl shadow-sm max-w-sm w-full">
        <h1 className="text-2xl font-bold text-center mb-2">Digital Family</h1>
        <p className="text-gray-500 text-center text-sm mb-6">Sign in with your email</p>

        {error && (
          <div className="bg-red-50 text-red-700 px-4 py-2 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)}>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="you@example.com"
            {...register('email', { required: 'Email is required' })}
          />
          {errors.email && (
            <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>
          )}

          <button
            type="submit"
            className="w-full mt-4 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-medium"
          >
            Send login link
          </button>
        </form>
      </div>
    </div>
  );
}
