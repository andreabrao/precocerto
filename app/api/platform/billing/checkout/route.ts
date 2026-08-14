import { env } from "cloudflare:workers";
import { getRawDb } from "@/db";
import { ensureCuritibaDatabase } from "@/db/bootstrap";
import { attachSubscriptionReference, createPendingSubscription, requirePlatformRole } from "@/db/platform";
import { requirePlatformIdentity } from "@/lib/platform-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const identity = await requirePlatformIdentity(request);
    const body = await request.json() as { planId?: string };
    const planId = body.planId?.trim() ?? "";
    const db = getRawDb();
    await ensureCuritibaDatabase(db);
    const account = await requirePlatformRole(db, identity, ["retailer"]);
    const plan = await db.prepare("SELECT id, name, price_cents AS priceCents FROM retail_plans WHERE id = ? AND active = 1").bind(planId).first<{ id: string; name: string; priceCents: number }>();
    if (!plan) return Response.json({ error: "Plano não encontrado." }, { status: 404 });
    if (plan.priceCents <= 0) return Response.json({ error: "Fale com a equipe para contratar este plano." }, { status: 400 });
    const token = (env as typeof env & { MERCADO_PAGO_ACCESS_TOKEN?: string }).MERCADO_PAGO_ACCESS_TOKEN;
    const publicUrl = (env as typeof env & { PUBLIC_APP_URL?: string }).PUBLIC_APP_URL?.replace(/\/+$/, "");
    const apiUrl = (env as typeof env & { API_PUBLIC_URL?: string }).API_PUBLIC_URL?.replace(/\/+$/, "");
    if (!token || !publicUrl || !apiUrl) return Response.json({ error: "O checkout ainda não foi configurado pelo administrador." }, { status: 503 });
    const subscriptionId = await createPendingSubscription(db, account.id, plan.id);
    const returnUrl = `${publicUrl}/#acesso?checkout=${encodeURIComponent(subscriptionId)}`;
    const payment = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        items: [{ id: plan.id, title: `PreçoCerto ${plan.name}`, quantity: 1, currency_id: "BRL", unit_price: plan.priceCents / 100 }],
        payer: { email: account.email },
        external_reference: subscriptionId,
        back_urls: { success: returnUrl, pending: returnUrl, failure: returnUrl },
        notification_url: `${apiUrl}/api/platform/billing/webhook`,
        auto_return: "approved",
      }),
    });
    const payload = await payment.json().catch(() => ({})) as { init_point?: string; sandbox_init_point?: string; id?: string; message?: string };
    if (!payment.ok || !payload.init_point || !payload.id) throw new Error(payload.message ?? "O Mercado Pago não conseguiu iniciar o checkout.");
    await attachSubscriptionReference(db, subscriptionId, payload.id);
    return Response.json({ checkoutUrl: payload.init_point, subscriptionId });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível iniciar o checkout." }, { status: 403 });
  }
}
