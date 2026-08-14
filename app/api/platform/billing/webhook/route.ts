import { env } from "cloudflare:workers";
import { getRawDb } from "@/db";
import { ensureCuritibaDatabase } from "@/db/bootstrap";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const token = (env as typeof env & { MERCADO_PAGO_ACCESS_TOKEN?: string }).MERCADO_PAGO_ACCESS_TOKEN;
  if (!token) return Response.json({ error: "Checkout indisponível." }, { status: 503 });
  try {
    const url = new URL(request.url);
    const body = await request.json().catch(() => ({})) as { data?: { id?: string | number }; type?: string; action?: string };
    const paymentId = String(body.data?.id ?? url.searchParams.get("data.id") ?? "").trim();
    const notificationType = body.type ?? url.searchParams.get("type") ?? "";
    if (!paymentId || (notificationType && notificationType !== "payment")) return Response.json({ received: true });
    const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, { headers: { authorization: `Bearer ${token}` } });
    const payment = await paymentResponse.json().catch(() => ({})) as { status?: string; external_reference?: string };
    if (!paymentResponse.ok || !payment.external_reference) return Response.json({ received: true });
    const status = payment.status === "approved" ? "active" : payment.status === "rejected" || payment.status === "cancelled" ? "cancelled" : "pending";
    const db = getRawDb();
    await ensureCuritibaDatabase(db);
    await db.prepare("UPDATE retailer_subscriptions SET status = ?, updated_at = ? WHERE id = ? AND provider = 'mercado_pago'").bind(status, new Date().toISOString(), payment.external_reference).run();
    return Response.json({ received: true });
  } catch {
    return Response.json({ received: true });
  }
}
