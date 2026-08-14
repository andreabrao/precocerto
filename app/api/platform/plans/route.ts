import { getRawDb } from "@/db";
import { ensureCuritibaDatabase } from "@/db/bootstrap";
import { listRetailPlans } from "@/db/platform";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getRawDb();
    await ensureCuritibaDatabase(db);
    return Response.json({ plans: await listRetailPlans(db) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível carregar os planos." }, { status: 500 });
  }
}
