import { getRawDb } from "@/db";
import { ensureCuritibaDatabase } from "@/db/bootstrap";
import { getRetailerDashboard, requirePlatformRole } from "@/db/platform";
import { getStoreOffers } from "@/db/queries";
import { requirePlatformIdentity } from "@/lib/platform-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const identity = await requirePlatformIdentity(request);
    const db = getRawDb();
    await ensureCuritibaDatabase(db);
    const account = await requirePlatformRole(db, identity, ["retailer"]);
    const dashboard = await getRetailerDashboard(db, account);
    return Response.json({ ...dashboard, offers: await getStoreOffers(db, dashboard.storeId, 12) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível abrir o painel do varejista." }, { status: 403 });
  }
}
