import { createContext, useState, type ReactNode } from 'react';
import type { User } from '../types/models';
import { getStoredToken, setStoredToken, clearStoredSession, USER_KEY } from '../lib/api-client';

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

  return <AuthContext.Provider value={{ token, user, login, logout }}>{children}</AuthContext.Provider>;
}
