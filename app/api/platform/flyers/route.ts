import { env } from "cloudflare:workers";
import { getRawDb } from "@/db";
import { ensureCuritibaDatabase } from "@/db/bootstrap";
import { createFlyerJob, listFlyerJobs, requirePlatformRole, requireRetailerPlanAllowance } from "@/db/platform";
import { requirePlatformIdentity } from "@/lib/platform-auth";

export const dynamic = "force-dynamic";

const acceptedTypes: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const maxFlyerBytes = 8 * 1024 * 1024;

export async function GET(request: Request) {
  try {
    const identity = await requirePlatformIdentity(request);
    const db = getRawDb();
    await ensureCuritibaDatabase(db);
    const account = await requirePlatformRole(db, identity, ["admin", "retailer"]);
    return Response.json({ jobs: await listFlyerJobs(db, account.role === "retailer" ? account.retailerStoreId ?? undefined : undefined) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível carregar os folhetos." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  const bucket = (env as typeof env & { CONTRIBUTION_IMAGES?: R2Bucket }).CONTRIBUTION_IMAGES;
  if (!bucket) return Response.json({ error: "O armazenamento de folhetos ainda não está disponível." }, { status: 503 });
  try {
    const identity = await requirePlatformIdentity(request);
    const form = await request.formData();
    const requestedStoreId = String(form.get("storeId") ?? "").trim();
    const flyer = form.get("flyer");
    if (!(flyer instanceof File) || !acceptedTypes[flyer.type] || flyer.size === 0 || flyer.size > maxFlyerBytes) {
      return Response.json({ error: "Envie um folheto JPG, PNG ou WebP de até 8 MB." }, { status: 400 });
    }
    const db = getRawDb();
    await ensureCuritibaDatabase(db);
    const account = await requirePlatformRole(db, identity, ["admin", "retailer"]);
    const storeId = account.role === "retailer" ? account.retailerStoreId : requestedStoreId;
    if (!storeId) return Response.json({ error: "Associe a conta do varejista a uma loja antes de enviar um folheto." }, { status: 400 });
    await requireRetailerPlanAllowance(db, account.id, "flyer");
    const store = await db.prepare("SELECT id FROM stores WHERE id = ? AND active = 1").bind(storeId).first<{ id: string }>();
    if (!store) return Response.json({ error: "Loja não encontrada." }, { status: 404 });
    const jobId = crypto.randomUUID();
    const imageKey = `flyers/${jobId}.${acceptedTypes[flyer.type]}`;
    await bucket.put(imageKey, await flyer.arrayBuffer(), { httpMetadata: { contentType: flyer.type }, customMetadata: { storeId, submittedBy: account.id } });
    const job = await createFlyerJob(db, { id: jobId, storeId, submittedByUserId: account.id, imageKey, imageContentType: flyer.type, originalFilename: flyer.name || "folheto" });
    return Response.json({ job }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível enviar o folheto." }, { status: 403 });
  }
}
