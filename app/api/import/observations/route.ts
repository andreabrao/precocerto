import { env } from "cloudflare:workers";
import { ensureCuritibaDatabase } from "@/db/bootstrap";
import { getRawDb } from "@/db";
import { notifyPriceAlertSubscribers } from "@/db/community";
import { importObservation, isKnownStoreAndProduct, type ImportSourceType } from "@/db/queries";

export const dynamic = "force-dynamic";

type ImportPayload = {
  storeId?: string;
  productId?: string;
  priceCents?: number;
  sourceType?: ImportSourceType;
  sourceUrl?: string;
  expiresAt?: string;
  confidence?: number;
};

function timingSafeEqual(a: string, b: string) {
  const encoder = new TextEncoder();
  const bytesA = encoder.encode(a);
  const bytesB = encoder.encode(b);
  // Sempre compara o mesmo número de bytes (o tamanho da chave configurada)
  // para não vazar o comprimento da chave recebida via timing.
  let mismatch = bytesA.length === bytesB.length ? 0 : 1;
  const length = Math.max(bytesA.length, bytesB.length);
  for (let index = 0; index < length; index += 1) {
    mismatch |= (bytesA[index] ?? 0) ^ (bytesB[index] ?? 0);
  }
  return mismatch === 0;
}

function validHttpsUrl(value: string | undefined) {
  if (!value) return true;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const configuredKey = (env as typeof env & { IMPORT_API_KEY?: string }).IMPORT_API_KEY;
  if (!configuredKey) {
    return Response.json({ error: "IMPORT_API_KEY não configurada." }, { status: 503 });
  }
  const providedKey = request.headers.get("x-import-key") ?? "";
  if (!timingSafeEqual(providedKey, configuredKey)) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const payload = (await request.json()) as ImportPayload;
    const storeId = payload.storeId?.trim() ?? "";
    const productId = payload.productId?.trim() ?? "";
    const sourceType = payload.sourceType;
    const priceCents = payload.priceCents;
    const isKnownSourceType = sourceType === "official_flyer" || sourceType === "authorized_feed" || sourceType === "manual_review";
    const requiresSourceUrl = sourceType === "official_flyer" || sourceType === "authorized_feed";
    if (!storeId || !productId || typeof priceCents !== "number" || !Number.isInteger(priceCents) || priceCents <= 0 || !isKnownSourceType || !validHttpsUrl(payload.sourceUrl) || (requiresSourceUrl && !payload.sourceUrl)) {
      return Response.json({ error: "Observação inválida. Informe a origem, preço em centavos e URL HTTPS para fonte automática ou encarte oficial." }, { status: 400 });
    }
    if (payload.expiresAt && Number.isNaN(Date.parse(payload.expiresAt))) {
      return Response.json({ error: "Data de validade inválida." }, { status: 400 });
    }

    const db = getRawDb();
    await ensureCuritibaDatabase(db);
    if (!(await isKnownStoreAndProduct(db, storeId, productId))) {
      return Response.json({ error: "Loja ou produto não monitorado." }, { status: 404 });
    }
    const observation = await importObservation(db, {
      storeId,
      productId,
      priceCents,
      sourceType,
      sourceUrl: payload.sourceUrl,
      expiresAt: payload.expiresAt,
      confidence: payload.confidence,
    });
    const alertsCreated = await notifyPriceAlertSubscribers(db, {
      storeId,
      productId,
      priceCents,
      expiresAt: observation.expiresAt,
    });
    return Response.json({ observation, alertsCreated }, { status: 201 });
  } catch {
    return Response.json({ error: "Não foi possível importar a observação." }, { status: 500 });
  }
}
