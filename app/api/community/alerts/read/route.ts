import { getRawDb } from "@/db";
import { ensureCuritibaDatabase } from "@/db/bootstrap";
import { markCommunityNotificationsRead } from "@/db/community";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { contributorId?: string };
    const contributorId = payload.contributorId?.trim() ?? "";
    if (!contributorId) return Response.json({ error: "Participante obrigatório." }, { status: 400 });
    const db = getRawDb();
    await ensureCuritibaDatabase(db);
    await markCommunityNotificationsRead(db, contributorId);
    return Response.json({ status: "read" });
  } catch {
    return Response.json({ error: "Não foi possível marcar os alertas." }, { status: 500 });
  }
}
