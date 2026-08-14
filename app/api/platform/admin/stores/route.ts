import { getRawDb } from "@/db";
import { ensureCuritibaDatabase } from "@/db/bootstrap";
import { createManagedStore, listManagedStores, requirePlatformRole } from "@/db/platform";
import { requirePlatformIdentity } from "@/lib/platform-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const identity = await requirePlatformIdentity(request);
    const db = getRawDb();
    await ensureCuritibaDatabase(db);
    await requirePlatformRole(db, identity, ["admin"]);
    return Response.json({ stores: await listManagedStores(db) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível carregar as lojas." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    const identity = await requirePlatformIdentity(request);
    const body = await request.json() as { name?: string; city?: string; neighborhood?: string; latitude?: number; longitude?: number };
    const name = body.name?.trim().replace(/\s+/g, " ") ?? "";
    const city = body.city?.trim().replace(/\s+/g, " ") ?? "";
    const neighborhood = body.neighborhood?.trim().replace(/\s+/g, " ") ?? "";
    if (name.length < 3 || name.length > 100 || city.length < 3 || city.length > 60 || neighborhood.length < 2 || neighborhood.length > 80) {
      return Response.json({ error: "Informe nome, cidade e bairro válidos." }, { status: 400 });
    }
    const db = getRawDb();
    await ensureCuritibaDatabase(db);
    await requirePlatformRole(db, identity, ["admin"]);
    const store = await createManagedStore(db, { name, city, neighborhood, latitude: body.latitude, longitude: body.longitude });
    return Response.json({ store }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível cadastrar a loja." }, { status: 403 });
  }
}
