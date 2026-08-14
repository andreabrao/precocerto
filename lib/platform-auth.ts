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

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function verifySupabaseToken(token: string) {
  const secret = (env as typeof env & { SUPABASE_JWT_SECRET?: string }).SUPABASE_JWT_SECRET;
  if (!secret) throw new Error("A autenticação ainda não foi configurada.");
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
