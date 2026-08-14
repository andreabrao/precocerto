import { getRawDb } from "@/db";
import { ensureCuritibaDatabase } from "@/db/bootstrap";
import { assignPlatformUser, requirePlatformRole } from "@/db/platform";
import { requirePlatformIdentity, type PlatformRole } from "@/lib/platform-auth";

export const dynamic = "force-dynamic";

const validRoles: PlatformRole[] = ["customer", "retailer", "admin"];

export async function POST(request: Request) {
  try {
    const identity = await requirePlatformIdentity(request);
    const body = await request.json() as { email?: string; role?: PlatformRole; retailerStoreId?: string | null };
    const email = body.email?.trim().toLowerCase() ?? "";
    if (!/^\S+@\S+\.\S+$/.test(email) || !body.role || !validRoles.includes(body.role)) {
      return Response.json({ error: "Informe e-mail e perfil válidos." }, { status: 400 });
    }
    if (body.role === "retailer" && !body.retailerStoreId) {
      return Response.json({ error: "Associe o varejista a uma loja." }, { status: 400 });
    }

    const db = getRawDb();
    await ensureCuritibaDatabase(db);
    await requirePlatformRole(db, identity, ["admin"]);
    if (body.role === "retailer") {
      const store = await db.prepare("SELECT id FROM stores WHERE id = ? AND active = 1").bind(body.retailerStoreId).first();
      if (!store) return Response.json({ error: "A loja selecionada não existe ou está inativa." }, { status: 400 });
    }
    await assignPlatformUser(db, { email, role: body.role, retailerStoreId: body.role === "retailer" ? body.retailerStoreId : null });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível atualizar o acesso." }, { status: 403 });
  }
}
