import { getRawDb } from "@/db";
import { ensureCuritibaDatabase } from "@/db/bootstrap";
import { getLeaderboard } from "@/db/community";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getRawDb();
    await ensureCuritibaDatabase(db);
    return Response.json({ leaderboard: await getLeaderboard(db) });
  } catch {
    return Response.json({ error: "Não foi possível carregar o ranking." }, { status: 500 });
  }
}
