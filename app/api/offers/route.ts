import { ensureCuritibaDatabase } from "@/db/bootstrap";
import { getRawDb } from "@/db";
import { getOffers } from "@/db/queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const category = new URL(request.url).searchParams.get("category") ?? undefined;
    const db = getRawDb();
    await ensureCuritibaDatabase(db);
    return Response.json({ city: "Curitiba", offers: await getOffers(db, category), generatedAt: new Date().toISOString() });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Não foi possível carregar as ofertas." },
      { status: 500 },
    );
  }
}
