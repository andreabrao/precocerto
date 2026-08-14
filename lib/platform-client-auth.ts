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

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? "").trim().replace(/\/+$/, "");
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();
const sessionKey = "precocerto-platform-session";
const landingSeenKey = "precocerto-platform-landing-seen";

export function isAuthConfigured() {
  return Boolean(supabaseUrl && supabaseAnonKey);
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
  const payload = await response.json().catch(() => ({})) as { error_description?: string; msg?: string; access_token?: string; refresh_token?: string };
  if (!response.ok || !payload.access_token) throw new Error(payload.error_description ?? payload.msg ?? "Não foi possível concluir o login.");
  return { access_token: payload.access_token, refresh_token: payload.refresh_token } satisfies AuthSession;
}

export async function signInWithPassword(email: string, password: string) {
  const session = await supabaseRequest("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  saveSession(session);
  return session;
}

export async function signUpWithPassword(email: string, password: string, displayName: string) {
  const session = await supabaseRequest("/auth/v1/signup", {
    method: "POST",
    body: JSON.stringify({ email, password, data: { full_name: displayName } }),
  });
  saveSession(session);
  return session;
}

export async function fetchPlatformAccount(token: string) {
  const response = await fetch(apiUrl("/api/platform/me"), { headers: { authorization: `Bearer ${token}` } });
  const payload = await response.json().catch(() => ({})) as { account?: PlatformAccount; error?: string };
  if (!response.ok || !payload.account) throw new Error(payload.error ?? "Não foi possível carregar a sua conta.");
  return payload.account;
}

export function clearSession() {
  window.sessionStorage.removeItem(sessionKey);
}
