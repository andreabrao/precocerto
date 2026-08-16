// Não existe `wrangler.toml` neste repositório, então o `wrangler types` não
// pode gerar este arquivo automaticamente. Os bindings e variáveis abaixo
// refletem o que o código já espera em tempo de execução (ver
// `worker/index.ts`, `.dev.vars.example` e `.openai/hosting.json`).
// Se um binding novo for adicionado no ambiente de produção, adicione-o aqui
// também para manter o typecheck honesto.
declare namespace Cloudflare {
interface Env {
  // Bindings (Cloudflare / plataforma de hosting)
  ASSETS: Fetcher;
  DB: D1Database;
  CONTRIBUTION_IMAGES?: R2Bucket;
  IMAGES?: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };

  // CORS / rede
  FRONTEND_ORIGIN?: string;

  // Importação de fonte autorizada
  IMPORT_API_KEY?: string;

  // Supabase Auth
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  SUPABASE_JWT_SECRET?: string;
  ADMIN_BOOTSTRAP_EMAIL?: string;

  // Leitura de encarte por IA
  OPENAI_API_KEY?: string;
  OPENAI_FLYER_MODEL?: string;

  // Cobrança
  MERCADO_PAGO_ACCESS_TOKEN?: string;

  // URLs públicas
  PUBLIC_APP_URL?: string;
  API_PUBLIC_URL?: string;
}
}
