"use client";

// Frappe-native auth (nahradil Clerk).
// JWT (HS256, bez expirácie) príde z iOS appky cez /sso/callback?token=...,
// alebo z web login formulára (auth.login). Ukladá sa do localStorage.
// Identita = email (payload.sub). Rola = payload.role ("advisor" | "client").

import { decodeJwt } from "jose";
import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

const STORAGE_KEY = "frappe_jwt";

export type FrappeUser = {
  email: string;
  role: string; // "advisor" | "client"
  fullName?: string;
};

type AuthState = {
  ready: boolean; // hydratované z localStorage
  token: string | null;
  user: FrappeUser | null;
  isSignedIn: boolean;
  signIn: (token: string, fullName?: string) => void;
  signOut: () => void;
};

function parseToken(token: string): FrappeUser | null {
  try {
    const p = decodeJwt(token) as { sub?: string; role?: string; full_name?: string };
    if (!p.sub) return null;
    return {
      email: p.sub,
      role: (p.role as string) || "client",
      fullName: p.full_name,
    };
  } catch {
    return null;
  }
}

const AuthContext = createContext<AuthState | null>(null);

export function FrappeAuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<FrappeUser | null>(null);
  const [ready, setReady] = useState(false);

  // hydratácia z localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const u = parseToken(stored);
        if (u) {
          setToken(stored);
          setUser(u);
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      }
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  const signIn = useCallback((newToken: string, fullName?: string) => {
    const u = parseToken(newToken);
    if (!u) return;
    if (fullName) u.fullName = fullName;
    try {
      localStorage.setItem(STORAGE_KEY, newToken);
    } catch {
      /* ignore */
    }
    setToken(newToken);
    setUser(u);
  }, []);

  const signOut = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      ready,
      token,
      user,
      isSignedIn: !!token && !!user,
      signIn,
      signOut,
    }),
    [ready, token, user, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useFrappeAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useFrappeAuth musí byť vnútri <FrappeAuthProvider>");
  }
  return ctx;
}
