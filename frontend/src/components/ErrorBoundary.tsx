// =============================================================================
// ErrorBoundary.tsx — React Error Boundary with i18n Support
// =============================================================================
//
// Error boundaries MUST be class components, but class components can't use
// hooks (like useTranslation). So we split into two parts:
//   1. ErrorBoundary (class) — catches the error
//   2. ErrorFallback (function) — renders the fallback UI with translations
// =============================================================================

import { Component, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

// Functional component that can use i18n hooks
function ErrorFallback({ error }: { error: Error | null }) {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white p-8 rounded-xl shadow-sm max-w-md w-full text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <h1 className="text-xl font-bold text-gray-900 mb-2">{t('error.title')}</h1>
        <p className="text-gray-500 text-sm mb-6">{t('error.message')}</p>
        {error && (
          <p className="text-xs text-gray-400 mb-4 font-mono bg-gray-50 p-3 rounded-lg break-all">
            {error.message}
          </p>
        )}
        <div className="space-y-2">
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 font-medium"
          >
            {t('error.refresh')}
          </button>
          <a
            href="/"
            className="block w-full border border-gray-300 text-gray-700 py-2.5 rounded-lg hover:bg-gray-50 font-medium"
          >
            {t('error.home')}
          </a>
        </div>
      </div>
    </div>
  );
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}
