import { createContext, useState, useEffect, type ReactNode } from 'react';
import type { User } from '../types/models';
import { getStoredToken, setStoredToken, clearStoredSession, USER_KEY } from '../lib/api-client';
import { getCurrentUserRequest } from '../api/auth';

type StoredSession = { token: string; user: User };

function loadStoredUser(): User | null {
  const raw = localStorage.getItem(USER_KEY);
  return raw ? (JSON.parse(raw) as User) : null;
}

export type AuthContextValue = {
  token: string | null;
  user: User | null;
  login: (session: StoredSession) => void;
  logout: () => void;
};

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [user, setUser] = useState<User | null>(() => loadStoredUser());

  function login(session: StoredSession) {
    setStoredToken(session.token);
    localStorage.setItem(USER_KEY, JSON.stringify(session.user));
    setToken(session.token);
    setUser(session.user);
  }

  function logout() {
    clearStoredSession();
    setToken(null);
    setUser(null);
  }

  // Revalidate whenever the token changes (mount with a cached session, or a
  // fresh login) — the cached `user` is shown optimistically in the meantime,
  // then replaced with the server's current view, or cleared if the session
  // no longer holds (deleted/changed account, expired token). No redirect on
  // failure: an invalid cached session should just fall back to anonymous,
  // not yank the visitor off whatever page they're on.
  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    getCurrentUserRequest()
      .then((freshUser) => {
        if (cancelled) return;
        localStorage.setItem(USER_KEY, JSON.stringify(freshUser));
        setUser(freshUser);
      })
      .catch(() => {
        if (!cancelled) logout();
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  return <AuthContext.Provider value={{ token, user, login, logout }}>{children}</AuthContext.Provider>;
}
