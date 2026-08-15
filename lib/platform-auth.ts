import { env } from "cloudflare:workers";

export type PlatformRole = "customer" | "retailer" | "admin";

export type PlatformIdentity = {
  id: string;
  email: string;
  displayName?: string;
};

type JwtPayload = {
  sub?: string;
  email?: string;
  user_metadata?: { full_name?: string; name?: string };
  aud?: string | string[];
  exp?: number;
};

type SupabaseUser = {
  id?: string;
  email?: string;
  user_metadata?: { full_name?: string; name?: string };
};

type PlatformAuthEnvironment = typeof env & {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_JWT_SECRET?: string;
};

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function verifySupabaseToken(token: string) {
  const runtime = env as PlatformAuthEnvironment;
  const supabaseUrl = runtime.SUPABASE_URL?.trim().replace(/\/+$/, "");
  const supabaseAnonKey = runtime.SUPABASE_ANON_KEY?.trim();

  // The Auth endpoint validates both legacy HMAC tokens and newer signing-key
  // projects. It also avoids storing a JWT signing secret in this application.
  if (supabaseUrl && supabaseAnonKey) {
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: supabaseAnonKey,
        authorization: `Bearer ${token}`,
      },
    });
    const user = await response.json().catch(() => ({})) as SupabaseUser;
    if (!response.ok || !user.id || !user.email) throw new Error("Sessão inválida ou expirada.");
    return {
      id: user.id,
      email: user.email.toLowerCase(),
      displayName: user.user_metadata?.full_name ?? user.user_metadata?.name,
    } satisfies PlatformIdentity;
  }

  // Compatibility during a gradual migration from the original implementation.
  const secret = runtime.SUPABASE_JWT_SECRET;
  if (!secret) throw new Error("A autenticação ainda não foi configurada no servidor.");
  const [header, payload, signature, ...extra] = token.split(".");
  if (!header || !payload || !signature || extra.length > 0) throw new Error("Sessão inválida.");

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify(
    "HMAC",
    cryptoKey,
    decodeBase64Url(signature),
    new TextEncoder().encode(`${header}.${payload}`),
  );
  if (!valid) throw new Error("Sessão inválida.");

  const decoded = JSON.parse(new TextDecoder().decode(decodeBase64Url(payload))) as JwtPayload;
  if (!decoded.sub || !decoded.email || !decoded.exp || decoded.exp * 1000 <= Date.now()) throw new Error("Sessão expirada.");
  const audiences = Array.isArray(decoded.aud) ? decoded.aud : [decoded.aud];
  if (!audiences.includes("authenticated")) throw new Error("Sessão sem permissão de acesso.");
  return {
    id: decoded.sub,
    email: decoded.email.toLowerCase(),
    displayName: decoded.user_metadata?.full_name ?? decoded.user_metadata?.name,
  } satisfies PlatformIdentity;
}

export async function requirePlatformIdentity(request: Request) {
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) throw new Error("Faça login para continuar.");
  return verifySupabaseToken(token);
}

export function hasRole(role: PlatformRole, allowed: PlatformRole[]) {
  return allowed.includes(role);
}
