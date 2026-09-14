import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { authenticate, setToken, clearToken, setAdminScope, getAdminScope, isGlobalAdmin } from '../api';
import type { AdminScope } from '../types';

interface AuthContextType {
  isAuthenticated: boolean;
  scope: AdminScope | null;
  isGlobal: boolean;
  login: (password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [scope, setScope] = useState<AdminScope | null>(() => {
    const stored = getAdminScope();
    if (stored === 'global') return 'global';
    if (stored?.startsWith('class:')) return stored as AdminScope;
    return null;
  });
  const [loading, setLoading] = useState(false);

  const isAuthenticated = scope !== null;

  useEffect(() => {
    if (!localStorage.getItem('jtk25_admin_token')) {
      setScope(null);
    }
  }, []);

  async function login(password: string) {
    setLoading(true);
    try {
      const result = await authenticate(password);
      if (result.ok) {
        setToken(password);
        setAdminScope(result.scope);
        setScope(result.scope as AdminScope);
      } else {
        throw new Error('Login gagal');
      }
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    clearToken();
    localStorage.removeItem('jtk25_admin_scope');
    setScope(null);
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, scope, isGlobal: isGlobalAdmin(), login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
