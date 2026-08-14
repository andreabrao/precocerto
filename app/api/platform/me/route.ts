import { getRawDb } from "@/db";
import { ensureCuritibaDatabase } from "@/db/bootstrap";
import { getOrCreatePlatformAccount } from "@/db/platform";
import { requirePlatformIdentity } from "@/lib/platform-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const identity = await requirePlatformIdentity(request);
    const db = getRawDb();
    await ensureCuritibaDatabase(db);
    return Response.json({ account: await getOrCreatePlatformAccount(db, identity) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível validar a conta." }, { status: 401 });
  }
}
