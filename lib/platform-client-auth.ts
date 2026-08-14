import { apiUrl } from "@/lib/client-config";

export type PlatformRole = "customer" | "retailer" | "admin";

export type PlatformAccount = {
  id: string;
  email: string;
  displayName?: string;
  role: PlatformRole;
  retailerStoreId?: string | null;
  retailerStoreName?: string | null;
};

type AuthSession = { access_token: string; refresh_token?: string };
type SupabaseAuthResponse = Partial<AuthSession> & { error_description?: string; msg?: string };

export class PlatformClientRequestError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "PlatformClientRequestError";
  }
}

let supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? "").trim().replace(/\/+$/, "");
let supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();
const sessionKey = "precocerto-platform-session";
const landingSeenKey = "precocerto-platform-landing-seen";

export function isAuthConfigured() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

export async function loadSupabaseConfiguration() {
  if (isAuthConfigured()) return true;
  try {
    const response = await fetch(apiUrl("/api/platform/config"));
    const payload = await response.json().catch(() => ({})) as { supabaseUrl?: string; supabaseAnonKey?: string };
    const nextUrl = payload.supabaseUrl?.trim().replace(/\/+$/, "") ?? "";
    const nextAnonKey = payload.supabaseAnonKey?.trim() ?? "";
    if (!nextUrl || !nextAnonKey) return false;
    supabaseUrl = nextUrl;
    supabaseAnonKey = nextAnonKey;
    return true;
  } catch {
    return false;
  }
}

export function hasSeenLanding() {
  return typeof window !== "undefined" && window.localStorage.getItem(landingSeenKey) === "true";
}

export function rememberLandingSeen() {
  window.localStorage.setItem(landingSeenKey, "true");
}

export function loadSession() {
  if (typeof window === "undefined") return undefined;
  const raw = window.sessionStorage.getItem(sessionKey);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    window.sessionStorage.removeItem(sessionKey);
    return undefined;
  }
}

function saveSession(session: AuthSession) {
  window.sessionStorage.setItem(sessionKey, JSON.stringify(session));
}

async function supabaseRequest(path: string, init: RequestInit) {
  if (!isAuthConfigured()) throw new Error("Configure o Supabase para ativar os logins.");
  const response = await fetch(`${supabaseUrl}${path}`, {
    ...init,
    headers: {
      apikey: supabaseAnonKey,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const payload = await response.json().catch(() => ({})) as SupabaseAuthResponse;
  if (!response.ok) throw new PlatformClientRequestError(payload.error_description ?? payload.msg ?? "Não foi possível concluir o acesso.", response.status);
  return payload;
}

export async function signInWithPassword(email: string, password: string) {
  const response = await supabaseRequest("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (!response.access_token) throw new Error("Não foi possível concluir o login.");
  const session = { access_token: response.access_token, refresh_token: response.refresh_token } satisfies AuthSession;
  saveSession(session);
  return session;
}

export async function signUpWithPassword(email: string, password: string, displayName: string) {
  const response = await supabaseRequest("/auth/v1/signup", {
    method: "POST",
    body: JSON.stringify({ email, password, data: { full_name: displayName } }),
  });
  if (!response.access_token) return undefined;
  const session = { access_token: response.access_token, refresh_token: response.refresh_token } satisfies AuthSession;
  saveSession(session);
  return session;
}

export async function refreshPlatformSession(refreshToken: string) {
  const response = await supabaseRequest("/auth/v1/token?grant_type=refresh_token", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!response.access_token) throw new Error("Não foi possível renovar sua sessão.");
  const session = { access_token: response.access_token, refresh_token: response.refresh_token ?? refreshToken } satisfies AuthSession;
  saveSession(session);
  return session;
}

export async function fetchPlatformAccount(token: string) {
  const response = await fetch(apiUrl("/api/platform/me"), { headers: { authorization: `Bearer ${token}` } });
  const payload = await response.json().catch(() => ({})) as { account?: PlatformAccount; error?: string };
  if (!response.ok || !payload.account) throw new PlatformClientRequestError(payload.error ?? "Não foi possível carregar a sua conta.", response.status);
  return payload.account;
}

export function clearSession() {
  window.sessionStorage.removeItem(sessionKey);
}
