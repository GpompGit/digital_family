// =============================================================================
// ErrorBoundary.tsx — React Error Boundary
// =============================================================================
//
// WHAT IS AN ERROR BOUNDARY?
// Normally, if a React component throws an error during rendering, the ENTIRE
// app crashes and shows a white screen. Error boundaries catch these errors
// and display a friendly fallback UI instead.
//
// Think of it like a try/catch for React components:
//   try { render component } catch (error) { show fallback }
//
// WHY A CLASS COMPONENT?
// Error boundaries MUST be class components because React's error-catching
// lifecycle methods (getDerivedStateFromError, componentDidCatch) are only
// available in class components, not in function components or hooks.
// This is one of the few cases where class components are still needed.
//
// USAGE:
// Wrap parts of your app that should fail gracefully:
//   <ErrorBoundary>
//     <DocumentPage />   ← if this crashes, the error boundary catches it
//   </ErrorBoundary>
//
// WHAT IT DOESN'T CATCH:
//   - Errors in event handlers (use try/catch in onClick, etc.)
//   - Errors in async code (useEffect, promises)
//   - Errors in the error boundary itself
// =============================================================================

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  // Called when a child component throws during rendering.
  // Returns new state to trigger a re-render with the fallback UI.
  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  // Called after an error is caught — use for logging.
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="bg-white p-8 rounded-xl shadow-sm max-w-md w-full text-center">
            <div className="text-4xl mb-4">⚠️</div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h1>
            <p className="text-gray-500 text-sm mb-6">
              An unexpected error occurred. Please try refreshing the page.
            </p>
            {this.state.error && (
              <p className="text-xs text-gray-400 mb-4 font-mono bg-gray-50 p-3 rounded-lg break-all">
                {this.state.error.message}
              </p>
            )}
            <div className="space-y-2">
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-medium"
              >
                Refresh page
              </button>
              <a
                href="/"
                className="block w-full border border-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-50 font-medium"
              >
                Go to home
              </a>
            </div>
          </div>
        </div>
      );
    }

    // No error — render children normally
    return this.props.children;
  }
}
