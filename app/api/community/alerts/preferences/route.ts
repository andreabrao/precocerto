import { getRawDb } from "@/db";
import { ensureCuritibaDatabase } from "@/db/bootstrap";
import { savePriceAlertPreference } from "@/db/community";
import { isKnownStoreAndProduct } from "@/db/queries";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { contributorId?: string; productId?: string; targetCents?: number };
    const contributorId = payload.contributorId?.trim() ?? "";
    const productId = payload.productId?.trim() ?? "";
    if (!contributorId || !productId || !Number.isInteger(payload.targetCents) || (payload.targetCents ?? 0) <= 0) {
      return Response.json({ error: "Alerta inválido." }, { status: 400 });
    }
    const db = getRawDb();
    await ensureCuritibaDatabase(db);
    if (!(await isKnownStoreAndProduct(db, "muffato-portao", productId))) {
      return Response.json({ error: "Produto não monitorado." }, { status: 404 });
    }
    await savePriceAlertPreference(db, contributorId, productId, payload.targetCents);
    return Response.json({ status: "active" }, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível criar o alerta." }, { status: 500 });
  }
}
