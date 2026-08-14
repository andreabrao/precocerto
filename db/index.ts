import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function getDb() {
  if (!env.DB) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. Set the `d1` field in .openai/hosting.json to `DB` or let your control plane inject the real binding values before using the database."
    );
  }

  return drizzle(env.DB, { schema });
}

export function getRawDb(): D1Database {
  if (!env.DB) {
    throw new Error(
      "A base local ainda não está disponível. Configure o binding D1 'DB' antes de usar os dados do PreçoCerto.",
    );
  }

  return env.DB;
}
