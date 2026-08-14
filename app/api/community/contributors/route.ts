import { getRawDb } from "@/db";
import { ensureCuritibaDatabase } from "@/db/bootstrap";
import { createContributor } from "@/db/community";

export const dynamic = "force-dynamic";

function validDisplayName(value: string) {
  return /^[\p{L}\p{N}][\p{L}\p{N} .'-]{1,27}$/u.test(value);
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { displayName?: string };
    const displayName = payload.displayName?.trim() ?? "";
    if (!validDisplayName(displayName)) {
      return Response.json({ error: "Use um nome de 2 a 28 caracteres." }, { status: 400 });
    }
    const db = getRawDb();
    await ensureCuritibaDatabase(db);
    return Response.json({ profile: await createContributor(db, displayName) }, { status: 201 });
  } catch {
    return Response.json({ error: "Não foi possível criar seu perfil de participação." }, { status: 500 });
  }
}
