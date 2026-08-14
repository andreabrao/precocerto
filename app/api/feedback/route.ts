import { ensureCuritibaDatabase } from "@/db/bootstrap";
import { getRawDb } from "@/db";
import { createFeedback, isKnownStoreAndProduct } from "@/db/queries";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { storeId?: string; productId?: string; reason?: string };
    const storeId = payload.storeId?.trim() ?? "";
    const productId = payload.productId?.trim() ?? "";
    const reason = payload.reason?.trim() ?? "Preço diferente na loja";
    if (!storeId || !productId || reason.length > 280) {
      return Response.json({ error: "Dados de feedback inválidos." }, { status: 400 });
    }
    const db = getRawDb();
    await ensureCuritibaDatabase(db);
    if (!(await isKnownStoreAndProduct(db, storeId, productId))) {
      return Response.json({ error: "Loja ou produto não monitorado." }, { status: 404 });
    }
    return Response.json({ feedback: await createFeedback(db, storeId, productId, reason) }, { status: 201 });
  } catch {
    return Response.json({ error: "Não foi possível registrar o feedback." }, { status: 500 });
  }
}
