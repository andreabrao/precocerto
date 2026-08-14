import { getRawDb } from "@/db";
import { ensureCuritibaDatabase } from "@/db/bootstrap";
import { getPlatformOverview, listFlyerJobs, listManagedStores, listRetailPlans, requirePlatformRole } from "@/db/platform";
import { requirePlatformIdentity } from "@/lib/platform-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const identity = await requirePlatformIdentity(request);
    const db = getRawDb();
    await ensureCuritibaDatabase(db);
    await requirePlatformRole(db, identity, ["admin"]);
    const [overview, plans, stores, jobs] = await Promise.all([getPlatformOverview(db), listRetailPlans(db), listManagedStores(db), listFlyerJobs(db)]);
    return Response.json({ overview, plans, stores, jobs });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível abrir a administração." }, { status: 403 });
  }
}
