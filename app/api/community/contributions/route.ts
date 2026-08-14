import { env } from "cloudflare:workers";
import { getRawDb } from "@/db";
import { ensureCuritibaDatabase } from "@/db/bootstrap";
import { createCommunityContribution } from "@/db/community";
import { isKnownStoreAndProduct } from "@/db/queries";
import { communityCollectionStores, curitibaStores } from "@/lib/curitiba-data";
import { approximatePoint, getPilotCoverageForPoint } from "@/lib/geo";

export const dynamic = "force-dynamic";

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const imageExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function asFiniteNumber(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function POST(request: Request) {
  const bucket = (env as typeof env & { CONTRIBUTION_IMAGES?: R2Bucket }).CONTRIBUTION_IMAGES;
  if (!bucket) return Response.json({ error: "O armazenamento de fotos ainda não está disponível." }, { status: 503 });

  try {
    const form = await request.formData();
    const contributorId = String(form.get("contributorId") ?? "").trim();
    const storeId = String(form.get("storeId") ?? "").trim();
    const marketName = String(form.get("marketName") ?? "").trim().replace(/\s+/g, " ");
    const productId = String(form.get("productId") ?? "").trim();
    const priceCents = asFiniteNumber(form.get("priceCents"));
    const latitude = asFiniteNumber(form.get("latitude"));
    const longitude = asFiniteNumber(form.get("longitude"));
    const photo = form.get("photo");
    if (!contributorId || !storeId || !productId || !Number.isInteger(priceCents) || (priceCents ?? 0) <= 0 || latitude === undefined || longitude === undefined || form.get("locationConsent") !== "true") {
      return Response.json({ error: "Preencha produto, mercado, preço, foto e consentimento de localização." }, { status: 400 });
    }
    const location = approximatePoint({ latitude, longitude });
    const coverage = getPilotCoverageForPoint(location);
    if (!coverage) {
      return Response.json({ error: "A contribuição precisa estar em Curitiba ou Itaperuçu." }, { status: 400 });
    }
    if (!(photo instanceof File) || !imageExtensions[photo.type] || photo.size === 0 || photo.size > MAX_PHOTO_BYTES) {
      return Response.json({ error: "Envie uma foto JPG, PNG ou WebP de até 5 MB." }, { status: 400 });
    }
    const db = getRawDb();
    await ensureCuritibaDatabase(db);
    if (!(await isKnownStoreAndProduct(db, storeId, productId))) {
      return Response.json({ error: "Mercado ou produto não monitorado." }, { status: 404 });
    }
    const collectionStore = communityCollectionStores.find((store) => store.id === storeId);
    const monitoredStore = curitibaStores.find((store) => store.id === storeId);
    if (collectionStore && collectionStore.city !== coverage.city) {
      return Response.json({ error: "Escolha o mercado correspondente à sua cidade atual." }, { status: 400 });
    }
    if (monitoredStore && coverage.city !== "Curitiba") {
      return Response.json({ error: "Esse mercado é monitorado em Curitiba. Em Itaperuçu, informe o mercado fotografado." }, { status: 400 });
    }
    const storeName = collectionStore ? marketName : monitoredStore?.name;
    if (!storeName || storeName.length < 3 || storeName.length > 80) {
      return Response.json({ error: "Informe o nome do mercado fotografado." }, { status: 400 });
    }

    const contributionId = crypto.randomUUID();
    const imageKey = `contributions/${contributionId}.${imageExtensions[photo.type]}`;
    await bucket.put(imageKey, await photo.arrayBuffer(), {
      httpMetadata: { contentType: photo.type },
      customMetadata: { storeId, storeName, productId, contributorId, city: coverage.city },
    });
    try {
      const contribution = await createCommunityContribution(db, {
        id: contributionId,
        contributorId,
        storeId,
        storeName,
        productId,
        imageKey,
        imageContentType: photo.type,
        priceCents,
        location,
      });
      return Response.json({ contribution }, { status: 201 });
    } catch (error) {
      await bucket.delete(imageKey);
      throw error;
    }
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Não foi possível receber a etiqueta." },
      { status: 500 },
    );
  }
}
