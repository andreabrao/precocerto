import { getRawDb } from "@/db";
import { ensureCuritibaDatabase } from "@/db/bootstrap";
import { getFlyerJob, listFlyerCandidates, requirePlatformRole, type FlyerCandidate } from "@/db/platform";
import { requirePlatformIdentity } from "@/lib/platform-auth";
import { canonicalProductSku } from "@/lib/comparison-products";

export const dynamic = "force-dynamic";

function productIdFor(candidate: { productName: string; brand: string; measure: string }) {
  return canonicalProductSku({
    name: candidate.productName,
    brand: candidate.brand,
    measure: candidate.measure,
  });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requirePlatformIdentity(request);
    const db = getRawDb();
    await ensureCuritibaDatabase(db);
    await requirePlatformRole(db, identity, ["admin"]);
    const { id } = await context.params;
    const job = await getFlyerJob(db, id);
    if (!job) return Response.json({ error: "Folheto não encontrado." }, { status: 404 });
    if (job.status !== "pending_review") return Response.json({ error: "Analise o folheto antes de publicar." }, { status: 409 });
    const timestamp = new Date().toISOString();
    const candidates = (await listFlyerCandidates(db, id))
      .filter((candidate: FlyerCandidate) => candidate.status === "pending_review")
      .filter((candidate: FlyerCandidate) => !candidate.validUntil || candidate.validUntil > timestamp);
    if (!candidates.length) return Response.json({ error: "Não há ofertas válidas para publicar. Revise a data de validade do folheto." }, { status: 409 });
    const fallbackExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const artifactId = `flyer-artifact-${job.id}`;
    const commands: D1PreparedStatement[] = [
      db.prepare("INSERT OR IGNORE INTO source_artifacts (id, source_type, source_url, captured_at, checksum, status) VALUES (?, 'official_flyer_ai_reviewed', NULL, ?, ?, 'verified')").bind(artifactId, timestamp, `flyer-${job.id}`),
    ];
    for (const candidate of candidates) {
      const productId = productIdFor(candidate);
      const observationId = crypto.randomUUID();
      commands.push(
        db.prepare("INSERT OR IGNORE INTO products (id, gtin, name, brand, category, measure, list_price_cents, active) VALUES (?, NULL, ?, ?, ?, ?, ?, 1)").bind(productId, candidate.productName, candidate.brand, candidate.category, candidate.measure, candidate.priceCents),
        db.prepare("INSERT INTO price_observations (id, store_id, product_id, artifact_id, price_cents, price_condition, observed_at, expires_at, confidence) VALUES (?, ?, ?, ?, ?, 'flyer_ai_reviewed', ?, ?, ?)").bind(observationId, job.storeId, productId, artifactId, candidate.priceCents, candidate.validFrom ?? timestamp, candidate.validUntil ?? fallbackExpiry, candidate.confidence),
        db.prepare("UPDATE flyer_offer_candidates SET status = 'published', published_observation_id = ? WHERE id = ?").bind(observationId, candidate.id),
      );
    }
    commands.push(db.prepare("UPDATE flyer_ingestion_jobs SET status = 'published', published_at = ? WHERE id = ?").bind(timestamp, job.id));
    await db.batch(commands);
    return Response.json({ publishedOffers: candidates.length, jobId: job.id });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível publicar as ofertas." }, { status: 403 });
  }
}
