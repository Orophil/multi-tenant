// Single typed fetch wrapper for the unified role-based feature-flag app.
// Reads the API base URL from NEXT_PUBLIC_API_URL, attaches the Bearer token
// from the shared session helpers, and throws the server error message on
// non-2xx responses. All localStorage/window access is delegated to lib/auth,
// which is guarded so this module is safe to import on the server (build time).

import { getToken } from "./auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

// ---- Types ----------------------------------------------------------------

export type Role = "super_admin" | "org_admin" | "end_user";

export interface AuthUser {
  id?: string;
  email: string;
  role: Role | string;
  orgId?: string | null;
  organizationName?: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface Organization {
  id: number | string;
  name: string;
  created_at: string;
}

export interface Flag {
  id: string;
  feature_key: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface FlagCheckResult {
  feature_key: string;
  enabled: boolean;
  organizationName: string;
}

// ---- Core request helper --------------------------------------------------

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const { method = "GET", body } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const token = getToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new Error(
      "Could not reach the server. Is the backend running on " + API_URL + "?"
    );
  }

  if (res.status === 204) {
    return undefined as T;
  }

  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const message =
      (data &&
        typeof data === "object" &&
        ((data as Record<string, unknown>).error ||
          (data as Record<string, unknown>).message)) ||
      (typeof data === "string" && data) ||
      `Request failed with status ${res.status}`;
    throw new Error(String(message));
  }

  return data as T;
}

// ---- Auth -----------------------------------------------------------------

export function login(input: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/login", {
    method: "POST",
    body: input,
  });
}

export function superAdminLogin(input: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/super-admin/login", {
    method: "POST",
    body: input,
  });
}

export function signup(input: {
  email: string;
  password: string;
  organizationName: string;
  role: "org_admin" | "end_user";
}): Promise<AuthResponse> {
  return request<AuthResponse>("/auth/signup", {
    method: "POST",
    body: input,
  });
}

// ---- Organizations (super_admin) ------------------------------------------

export function listOrganizations(): Promise<Organization[]> {
  return request<Organization[]>("/organizations", { method: "GET" });
}

export function createOrganization(name: string): Promise<Organization> {
  return request<Organization>("/organizations", {
    method: "POST",
    body: { name },
  });
}

// ---- Flags (org_admin) ----------------------------------------------------

export function getFlags(): Promise<Flag[]> {
  return request<Flag[]>("/flags", { method: "GET" });
}

export function createFlag(input: {
  feature_key: string;
  enabled?: boolean;
}): Promise<Flag> {
  return request<Flag>("/flags", {
    method: "POST",
    body: input,
  });
}

export function updateFlag(
  id: string,
  input: { enabled?: boolean; feature_key?: string }
): Promise<Flag> {
  return request<Flag>(`/flags/${id}`, {
    method: "PATCH",
    body: input,
  });
}

export function deleteFlag(id: string): Promise<void> {
  return request<void>(`/flags/${id}`, {
    method: "DELETE",
  });
}

// ---- Feature check (end_user / org_admin) ---------------------------------

export function checkFlag(feature_key: string): Promise<FlagCheckResult> {
  return request<FlagCheckResult>("/flags/check", {
    method: "POST",
    body: { feature_key },
  });
}
