"use client";
import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface AuthUser {
  user_id: number;
  username: string;
  full_name?: string;
  role: 'admin' | 'technical' | 'monitor';
  must_change_password: boolean;
  token: string;
  exp?: number; // JWT expiry timestamp (seconds)
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: (reason?: string) => void;
  isAdmin: () => boolean;
  isTechnical: () => boolean;
  canEdit: () => boolean;
  sessionExpiredMsg: string | null;
  clearSessionMsg: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Decode JWT payload (without verification - client side only)
function parseJwtExp(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp ?? null;
  } catch {
    return null;
  }
}

function isTokenExpired(token: string): boolean {
  const exp = parseJwtExp(token);
  if (!exp) return false;
  return Date.now() / 1000 > exp;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpiredMsg, setSessionExpiredMsg] = useState<string | null>(null);
  const router = useRouter();

  const logout = useCallback((reason?: string) => {
    setUser(null);
    localStorage.removeItem('cisco_auth');
    if (reason) setSessionExpiredMsg(reason);
    router.push('/login');
  }, [router]);

  // Load from localStorage + check token expiry on mount
  useEffect(() => {
    const stored = localStorage.getItem('cisco_auth');
    if (stored) {
      try {
        const parsed: AuthUser = JSON.parse(stored);
        // Check if token already expired
        if (parsed.token && isTokenExpired(parsed.token)) {
          localStorage.removeItem('cisco_auth');
          setSessionExpiredMsg('Session หมดอายุ กรุณา Login ใหม่');
        } else {
          // Store expiry in user object for display
          const exp = parseJwtExp(parsed.token);
          setUser({ ...parsed, exp: exp ?? undefined });
        }
      } catch {
        localStorage.removeItem('cisco_auth');
      }
    }
    setLoading(false);
  }, []);

  // Periodic token expiry check (every 60 seconds)
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      const stored = localStorage.getItem('cisco_auth');
      if (!stored) { logout('Session หมดอายุ กรุณา Login ใหม่'); return; }
      try {
        const parsed = JSON.parse(stored);
        if (isTokenExpired(parsed.token)) {
          logout('Session หมดอายุ กรุณา Login ใหม่');
        }
      } catch {
        logout('Session หมดอายุ กรุณา Login ใหม่');
      }
    }, 60 * 1000);
    return () => clearInterval(interval);
  }, [user, logout]);

  const login = async (username: string, password: string) => {
    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);

    const res = await fetch('/auth/login', { method: 'POST', body: formData });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Login ไม่สำเร็จ');
    }
    const data = await res.json();
    const exp = parseJwtExp(data.access_token);
    const authUser: AuthUser = {
      user_id: data.user_id,
      username,
      full_name: data.full_name,
      role: data.role,
      must_change_password: data.must_change_password,
      token: data.access_token,
      exp: exp ?? undefined,
    };
    setUser(authUser);
    setSessionExpiredMsg(null);
    localStorage.setItem('cisco_auth', JSON.stringify(authUser));

    if (data.must_change_password) {
      router.push('/change-password');
    } else {
      router.push('/');
    }
  };

  const isAdmin = () => user?.role === 'admin';
  const isTechnical = () => user?.role === 'technical';
  const canEdit = () => user?.role === 'admin' || user?.role === 'technical';
  const clearSessionMsg = () => setSessionExpiredMsg(null);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAdmin, isTechnical, canEdit, sessionExpiredMsg, clearSessionMsg }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

// Helper to get auth headers
export function authHeaders(): Record<string, string> {
  const stored = localStorage.getItem('cisco_auth');
  if (!stored) return {};
  try {
    const user = JSON.parse(stored);
    return { 'Authorization': `Bearer ${user.token}` };
  } catch {
    return {};
  }
}

// Global fetch with auto-401 handler (call logout callback via event)
export function createAuthFetch(logoutFn: (reason?: string) => void) {
  return async (url: string, options: RequestInit = {}): Promise<Response> => {
    const stored = localStorage.getItem('cisco_auth');
    const token = stored ? JSON.parse(stored).token : null;
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string> || {}),
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    };
    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      logoutFn('Session หมดอายุ กรุณา Login ใหม่');
    }
    return res;
  };
}
