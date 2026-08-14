import { ensureCuritibaDatabase } from "@/db/bootstrap";
import { getRawDb } from "@/db";
import { getComparison } from "@/db/queries";
import { MAX_RADIUS_KM, MIN_RADIUS_KM, isWithinPilotCoverage } from "@/lib/geo";

export const dynamic = "force-dynamic";

function readNumber(value: string | null) {
  if (value === null || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const basket = (url.searchParams.get("basket") ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
      .slice(0, 20);
    const latitude = readNumber(url.searchParams.get("lat"));
    const longitude = readNumber(url.searchParams.get("lng"));
    const radiusKm = readNumber(url.searchParams.get("radiusKm"));
    const sortBy = url.searchParams.get("sort");

    if ((latitude === undefined) !== (longitude === undefined)
      || (latitude !== undefined && !isWithinPilotCoverage({ latitude, longitude: longitude! }))
      || (radiusKm !== undefined && (radiusKm < MIN_RADIUS_KM || radiusKm > MAX_RADIUS_KM))
      || (sortBy !== null && sortBy !== "price" && sortBy !== "distance")) {
      return Response.json(
        { error: "Localização ou raio inválido para a cobertura piloto de Curitiba e Itaperuçu." },
        { status: 400 },
      );
    }
    const db = getRawDb();
    await ensureCuritibaDatabase(db);
    return Response.json(await getComparison(db, basket, {
      location: latitude === undefined ? undefined : { latitude, longitude: longitude! },
      radiusKm,
      sortBy: sortBy === "distance" ? "distance" : "price",
    }));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Não foi possível comparar a cesta." },
      { status: 500 },
    );
  }
}
