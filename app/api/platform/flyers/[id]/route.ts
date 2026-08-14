import { getRawDb } from "@/db";
import { ensureCuritibaDatabase } from "@/db/bootstrap";
import { getFlyerJob, listFlyerCandidates, requirePlatformRole } from "@/db/platform";
import { requirePlatformIdentity } from "@/lib/platform-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requirePlatformIdentity(request);
    const db = getRawDb();
    await ensureCuritibaDatabase(db);
    const account = await requirePlatformRole(db, identity, ["admin", "retailer"]);
    const { id } = await context.params;
    const job = await getFlyerJob(db, id);
    if (!job || (account.role === "retailer" && job.storeId !== account.retailerStoreId)) return Response.json({ error: "Folheto não encontrado." }, { status: 404 });
    return Response.json({ job, offers: await listFlyerCandidates(db, id) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível carregar o folheto." }, { status: 403 });
  }
}
