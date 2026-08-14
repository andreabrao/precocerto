import { ensureCuritibaDatabase } from "@/db/bootstrap";
import { getRawDb } from "@/db";
import { getStoreOffers } from "@/db/queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const storeId = new URL(request.url).searchParams.get("store")?.trim();
  if (!storeId || storeId.length > 120) {
    return Response.json({ error: "Informe um mercado válido." }, { status: 400 });
  }

  try {
    const db = getRawDb();
    await ensureCuritibaDatabase(db);
    const offers = await getStoreOffers(db, storeId);
    return Response.json({
      storeId,
      offers,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Não foi possível carregar as promoções deste mercado." },
      { status: 500 },
    );
  }
}
