import { getRawDb } from "@/db";
import { ensureCuritibaDatabase } from "@/db/bootstrap";
import { getCommunitySummary } from "@/db/community";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const contributorId = new URL(request.url).searchParams.get("contributorId")?.trim() ?? "";
    if (!contributorId) return Response.json({ error: "Participante obrigatório." }, { status: 400 });
    const db = getRawDb();
    await ensureCuritibaDatabase(db);
    const summary = await getCommunitySummary(db, contributorId);
    if (!summary) return Response.json({ error: "Participante não encontrado." }, { status: 404 });
    return Response.json(summary);
  } catch {
    return Response.json({ error: "Não foi possível carregar a comunidade." }, { status: 500 });
  }
}
