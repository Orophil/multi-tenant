// Session helpers backed by a SINGLE localStorage key set.
// All window/localStorage access is guarded so these are safe to import on the
// server (build time). Callers must only invoke the setters/clearers from
// "use client" components, inside event handlers or effects.

import { useEffect, useState } from "react";
import type { AuthUser } from "./api";

const TOKEN_KEY = "ff_token";
const USER_KEY = "ff_user";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function setSession(token: string, user: AuthUser): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

// Small client hook: resolves the stored session after mount so it never reads
// localStorage during render. `ready` flips to true once the check has run.
export interface AuthState {
  ready: boolean;
  token: string | null;
  user: AuthUser | null;
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({
    ready: false,
    token: null,
    user: null,
  });

  useEffect(() => {
    setState({ ready: true, token: getToken(), user: getUser() });
  }, []);

  return state;
}
