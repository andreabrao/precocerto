import { env } from "cloudflare:workers";
import { getRawDb } from "@/db";
import { ensureCuritibaDatabase } from "@/db/bootstrap";
import { getFlyerJob, markFlyerFailure, requirePlatformRole, requireRetailerPlanAllowance, saveFlyerCandidates } from "@/db/platform";
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
    if (job.status !== "queued" && job.status !== "failed") return Response.json({ error: "Este folheto já está sendo analisado ou aguarda revisão." }, { status: 409 });
    await requireRetailerPlanAllowance(db, job.submittedByUserId, "ai");
    const bucket = (env as typeof env & { CONTRIBUTION_IMAGES?: R2Bucket }).CONTRIBUTION_IMAGES;
    if (!bucket) return Response.json({ error: "O armazenamento de folhetos ainda não está disponível." }, { status: 503 });
    const image = await bucket.get(job.imageKey);
    if (!image) return Response.json({ error: "A imagem do folheto não foi encontrada." }, { status: 404 });
    const lock = await db.prepare("UPDATE flyer_ingestion_jobs SET status = 'processing', error_message = NULL WHERE id = ? AND status IN ('queued', 'failed')").bind(job.id).run();
    if (!lock.meta.changes) return Response.json({ error: "Este folheto foi atualizado por outra pessoa. Atualize a fila." }, { status: 409 });
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
