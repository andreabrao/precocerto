import { env } from "cloudflare:workers";

export const dynamic = "force-dynamic";

type PlatformConfigEnvironment = typeof env & {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
};

// The anon key is deliberately publishable. This endpoint lets the GitHub Pages
// frontend receive its Supabase configuration at runtime, without a secret or a
// second configuration step in the static build.
export async function GET() {
  const runtime = env as PlatformConfigEnvironment;
  const supabaseUrl = runtime.SUPABASE_URL?.trim().replace(/\/+$/, "");
  const supabaseAnonKey = runtime.SUPABASE_ANON_KEY?.trim();
  if (!supabaseUrl || !supabaseAnonKey) return Response.json({ configured: false });
  return Response.json({ configured: true, supabaseUrl, supabaseAnonKey });
}
