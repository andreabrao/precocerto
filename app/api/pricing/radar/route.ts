import { ensureCuritibaDatabase } from "@/db/bootstrap";
import { getRawDb } from "@/db";
import { getPricingRadar } from "@/db/queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const storeId = new URL(request.url).searchParams.get("store") ?? "muffato-portao";
    const db = getRawDb();
    await ensureCuritibaDatabase(db);
    return Response.json(await getPricingRadar(db, storeId));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Não foi possível carregar o radar de preços." },
      { status: 500 },
    );
  }
}
