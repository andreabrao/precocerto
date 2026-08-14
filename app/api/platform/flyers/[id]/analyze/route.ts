import { env } from "cloudflare:workers";
import { getRawDb } from "@/db";
import { ensureCuritibaDatabase } from "@/db/bootstrap";
import { getFlyerJob, markFlyerFailure, requirePlatformRole, saveFlyerCandidates } from "@/db/platform";
import { extractOffersFromFlyer } from "@/lib/flyer-ai";
import { requirePlatformIdentity } from "@/lib/platform-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requirePlatformIdentity(request);
    const db = getRawDb();
    await ensureCuritibaDatabase(db);
    await requirePlatformRole(db, identity, ["admin"]);
    const { id } = await context.params;
    const job = await getFlyerJob(db, id);
    if (!job) return Response.json({ error: "Folheto não encontrado." }, { status: 404 });
    if (job.status === "published") return Response.json({ error: "Este folheto já foi publicado." }, { status: 409 });
    const bucket = (env as typeof env & { CONTRIBUTION_IMAGES?: R2Bucket }).CONTRIBUTION_IMAGES;
    if (!bucket) return Response.json({ error: "O armazenamento de folhetos ainda não está disponível." }, { status: 503 });
    const image = await bucket.get(job.imageKey);
    if (!image) return Response.json({ error: "A imagem do folheto não foi encontrada." }, { status: 404 });
    await db.prepare("UPDATE flyer_ingestion_jobs SET status = 'processing', error_message = NULL WHERE id = ?").bind(job.id).run();
    try {
      const extraction = await extractOffersFromFlyer({ image: await image.arrayBuffer(), contentType: job.imageContentType, storeName: job.storeName, city: job.storeCity, neighborhood: job.storeNeighborhood });
      await saveFlyerCandidates(db, job.id, extraction.offers, extraction.model);
      return Response.json({ job: await getFlyerJob(db, job.id) }, { status: 201 });
    } catch (error) {
      await markFlyerFailure(db, job.id, error instanceof Error ? error.message : "Falha na leitura do folheto.");
      throw error;
    }
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível analisar o folheto." }, { status: 403 });
  }
}
