import { env } from "cloudflare:workers";

export type ExtractedFlyerOffer = {
  productName: string;
  brand: string;
  category: string;
  measure: string;
  priceCents: number;
  validFrom: string | null;
  validUntil: string | null;
  confidence: number;
};

type ExtractionPayload = { offers?: unknown };

function toDataUrl(buffer: ArrayBuffer, contentType: string) {
  const bytes = new Uint8Array(buffer);
  let value = "";
  for (let index = 0; index < bytes.length; index += 0x8000) value += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return `data:${contentType};base64,${btoa(value)}`;
}

function normalizeCandidate(value: unknown): ExtractedFlyerOffer | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as Record<string, unknown>;
  const productName = typeof candidate.productName === "string" ? candidate.productName.trim() : "";
  const priceCents = typeof candidate.priceCents === "number" ? Math.round(candidate.priceCents) : 0;
  if (productName.length < 2 || productName.length > 160 || priceCents <= 0 || priceCents > 1_000_000) return undefined;
  const shortText = (field: string, fallback: string, maximum = 80) => typeof candidate[field] === "string" && candidate[field].trim() ? candidate[field].trim().slice(0, maximum) : fallback;
  const date = (field: string, endOfDay = false) => {
    const value = candidate[field];
    if (typeof value !== "string") return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const timestamp = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}-03:00`);
      return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString();
    }
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(value) ? value : null;
  };
  const confidence = typeof candidate.confidence === "number" ? Math.min(100, Math.max(0, Math.round(candidate.confidence))) : 60;
  return {
    productName,
    brand: shortText("brand", "Sem marca"),
    category: shortText("category", "Outros"),
    measure: shortText("measure", "un"),
    priceCents,
    validFrom: date("validFrom"),
    validUntil: date("validUntil", true),
    confidence,
  };
}

function readOutputText(payload: Record<string, unknown>) {
  if (typeof payload.output_text === "string") return payload.output_text;
  const output = Array.isArray(payload.output) ? payload.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as { content?: unknown }).content) ? (item as { content: unknown[] }).content : [];
    for (const part of content) {
      if (part && typeof part === "object" && (part as { type?: string }).type === "output_text" && typeof (part as { text?: unknown }).text === "string") return (part as { text: string }).text;
    }
  }
  return undefined;
}

export async function extractOffersFromFlyer(input: { image: ArrayBuffer; contentType: string; storeName: string; city: string; neighborhood: string }) {
  const apiKey = (env as typeof env & { OPENAI_API_KEY?: string }).OPENAI_API_KEY;
  if (!apiKey) throw new Error("Configure OPENAI_API_KEY para ativar a leitura de folhetos por IA.");
  const model = (env as typeof env & { OPENAI_FLYER_MODEL?: string }).OPENAI_FLYER_MODEL ?? "gpt-4.1-mini";
  const schema = {
    type: "object",
    additionalProperties: false,
    required: ["offers"],
    properties: {
      offers: {
        type: "array",
        maxItems: 100,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["productName", "brand", "category", "measure", "priceCents", "validFrom", "validUntil", "confidence"],
          properties: {
            productName: { type: "string" },
            brand: { type: "string" },
            category: { type: "string" },
            measure: { type: "string" },
            priceCents: { type: "integer" },
            validFrom: { type: ["string", "null"] },
            validUntil: { type: ["string", "null"] },
            confidence: { type: "integer", minimum: 0, maximum: 100 },
          },
        },
      },
    },
  };
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      input: [{
        role: "user",
        content: [
          { type: "input_text", text: `Extraia somente promoções legíveis do folheto do mercado ${input.storeName}, em ${input.neighborhood}, ${input.city}, Brasil. Converta preços para centavos inteiros. Não invente produtos, marcas, datas ou preços. Use null quando a validade não estiver legível. Para datas sem horário, use YYYY-MM-DD; a validade final é o último dia anunciado. Retorne em português.` },
          { type: "input_image", image_url: toDataUrl(input.image, input.contentType), detail: "high" },
        ],
      }],
      text: { format: { type: "json_schema", name: "flyer_offers", strict: true, schema } },
    }),
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof payload.error === "object" && payload.error && "message" in payload.error ? String((payload.error as { message?: unknown }).message) : "A IA não conseguiu analisar o folheto.");
  const text = readOutputText(payload);
  if (!text) throw new Error("A IA não retornou ofertas estruturadas.");
  const extracted = JSON.parse(text) as ExtractionPayload;
  const offers = Array.isArray(extracted.offers) ? extracted.offers.map(normalizeCandidate).filter((candidate): candidate is ExtractedFlyerOffer => Boolean(candidate)) : [];
  if (offers.length === 0) throw new Error("A IA não encontrou preços legíveis neste folheto.");
  return { model, offers };
}
