// =============================================================================
// AuthContext.tsx — Global Authentication State (React Context)
// =============================================================================
//
// PROBLEM: Many components need to know if the user is logged in and who they are.
// Passing user data as props through every component (prop drilling) is tedious:
//   <App user={user}> → <Layout user={user}> → <Nav user={user}> → ...
//
// SOLUTION: React Context provides a way to share data across ALL components
// without passing props manually at every level. It works like a global variable,
// but managed by React.
//
// HOW IT WORKS:
//   1. createContext() creates a "mailbox" for the data
//   2. AuthProvider wraps the entire app and "puts data in the mailbox"
//   3. Any component can call useAuth() to "read the mailbox"
//
// PATTERN:
//   <AuthProvider>         ← provides user data to all children
//     <Layout>
//       <Nav />            ← calls useAuth() to get user.first_name
//       <DashboardPage />  ← calls useAuth() to check user.role
//     </Layout>
//   </AuthProvider>
//
// ON APP LOAD:
//   1. AuthProvider renders with loading=true
//   2. useEffect calls refresh() → GET /auth/status
//   3. Server checks the session cookie and returns user data (or "not authenticated")
//   4. AuthProvider updates user state → loading=false → children render
//
// This is why navigating to a protected page shows "Loading..." briefly —
// the app needs to verify the session before knowing if the user is logged in.
// =============================================================================

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { User } from '../types';
import { checkAuth, logout as apiLogout } from '../services/api';

// Define the shape of the data this context provides
interface AuthContextType {
  user: User | null;       // the logged-in user, or null if not logged in
  loading: boolean;        // true while checking authentication status
  refresh: () => Promise<void>;  // re-check auth (e.g., after login)
  logout: () => Promise<void>;   // log out and clear user state
}

// Create the context with default values (used if no Provider wraps the component)
const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  refresh: async () => {},
  logout: async () => {}
});

// The Provider component that wraps the app and manages auth state
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true); // start as loading

  // Check if the user is logged in by calling the backend
  async function refresh() {
    try {
      const result = await checkAuth(); // GET /auth/status
      // The "!" after result.user tells TypeScript "I know this isn't null"
      // (we only access it when authenticated is true)
      setUser(result.authenticated ? result.user! : null);
    } catch {
      setUser(null); // if the request fails, assume not logged in
    } finally {
      setLoading(false); // done loading regardless of result
    }
  }

  // Log out: tell the server to destroy the session, then clear local state
  async function logout() {
    await apiLogout(); // POST /auth/logout
    setUser(null);
  }

  // useEffect with [] runs ONCE when the component first mounts (app startup).
  // This is where we check if the user has an existing valid session.
  useEffect(() => {
    refresh();
  }, []);

  // Provider makes { user, loading, refresh, logout } available to all children
  return (
    <AuthContext.Provider value={{ user, loading, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// Custom hook — shortcut so components can write useAuth() instead of useContext(AuthContext)
export function useAuth() {
  return useContext(AuthContext);
}
