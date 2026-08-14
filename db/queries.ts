import {
  DEFAULT_RADIUS_KM,
  MAX_RADIUS_KM,
  MIN_RADIUS_KM,
  distanceInKm,
  getPilotCoverageForPoint,
  isWithinPilotCoverage,
  type GeoPoint,
} from "@/lib/geo";
import { curitibaProducts, curitibaStores } from "@/lib/curitiba-data";

type LatestPriceRow = {
  storeId: string;
  storeName: string;
  storeCity: string;
  neighborhood: string;
  storeLatitude: number | null;
  storeLongitude: number | null;
  productId: string;
  productName: string;
  brand: string;
  category: string;
  measure: string;
  listPriceCents: number;
  priceCents: number;
  artifactId: string | null;
  observedAt: string;
  expiresAt: string;
  confidence: number;
};

type ActiveStoreOfferRow = {
  storeId: string;
  storeName: string;
  storeCity: string;
  neighborhood: string;
  storeLatitude: number | null;
  storeLongitude: number | null;
  activeOfferCount: number;
  latestAt: string;
  confidence: number;
};

export type ComparisonSearch = {
  location?: GeoPoint;
  radiusKm?: number;
  sortBy?: "price" | "distance";
};

export type ImportSourceType = "official_flyer" | "authorized_feed" | "manual_review";

const distanceByStoreId: Record<string, number> = {
  "muffato-portao": 1.4,
  "condor-agua-verde": 2.1,
  "festval-batel": 2.7,
};

async function getLatestRows(db: D1Database, productIds: string[]) {
  if (productIds.length === 0) return [] as LatestPriceRow[];
  const placeholders = productIds.map(() => "?").join(", ");
  const query = `
    SELECT
      s.id AS storeId, s.name AS storeName, s.city AS storeCity, s.neighborhood AS neighborhood,
      s.latitude AS storeLatitude, s.longitude AS storeLongitude,
      p.id AS productId, p.name AS productName, p.category AS category,
      p.brand AS brand,
      p.measure AS measure, p.list_price_cents AS listPriceCents,
      po.price_cents AS priceCents, po.observed_at AS observedAt,
      po.artifact_id AS artifactId,
      po.expires_at AS expiresAt, po.confidence AS confidence
    FROM price_observations po
    INNER JOIN stores s ON s.id = po.store_id
    INNER JOIN products p ON p.id = po.product_id
    WHERE po.product_id IN (${placeholders})
      AND po.expires_at > ?
      AND po.observed_at <= ?
      AND po.observed_at = (
        SELECT MAX(latest.observed_at)
        FROM price_observations latest
        WHERE latest.store_id = po.store_id
          AND latest.product_id = po.product_id
          AND latest.expires_at > ?
          AND latest.observed_at <= ?
      )
    ORDER BY s.name, p.name
  `;
  const now = new Date().toISOString();
  const result = await db.prepare(query).bind(...productIds, now, now, now, now).all<LatestPriceRow>();
  return result.results ?? [];
}

async function getActiveStoreOffers(db: D1Database, city?: string) {
  const cityCondition = city ? "AND s.city = ?" : "";
  const query = `
    SELECT
      s.id AS storeId, s.name AS storeName, s.city AS storeCity,
      s.neighborhood AS neighborhood, s.latitude AS storeLatitude,
      s.longitude AS storeLongitude, COUNT(po.id) AS activeOfferCount,
      MAX(po.observed_at) AS latestAt, ROUND(AVG(po.confidence)) AS confidence
    FROM stores s
    INNER JOIN price_observations po ON po.store_id = s.id
    WHERE s.active = 1
      AND po.expires_at > ?
      AND po.observed_at <= ?
      ${cityCondition}
    GROUP BY s.id, s.name, s.city, s.neighborhood, s.latitude, s.longitude
    ORDER BY s.name
  `;
  const now = new Date().toISOString();
  const result = await db.prepare(query).bind(now, now, ...(city ? [city] : [])).all<ActiveStoreOfferRow>();
  return result.results ?? [];
}

function pointFromStore(row: Pick<LatestPriceRow, "storeLatitude" | "storeLongitude">): GeoPoint | undefined {
  if (row.storeLatitude === null || row.storeLongitude === null) return undefined;
  const point = {
    latitude: row.storeLatitude / 1_000_000,
    longitude: row.storeLongitude / 1_000_000,
  };
  return isWithinPilotCoverage(point) ? point : undefined;
}

function normalizeSearch(search: ComparisonSearch) {
  const location = search.location && isWithinPilotCoverage(search.location) ? search.location : undefined;
  const requestedRadius = search.radiusKm ?? DEFAULT_RADIUS_KM;
  const radiusKm = Math.min(MAX_RADIUS_KM, Math.max(MIN_RADIUS_KM, requestedRadius));
  return {
    location,
    coverage: location ? getPilotCoverageForPoint(location) : undefined,
    radiusKm,
    sortBy: search.sortBy === "distance" ? "distance" as const : "price" as const,
  };
}

export async function getComparison(db: D1Database, requestedIds: string[], search: ComparisonSearch = {}) {
  const productIds = requestedIds.length > 0
    ? requestedIds.filter((id) => curitibaProducts.some((product) => product.id === id))
    : curitibaProducts.slice(0, 3).map((product) => product.id);
  const normalizedSearch = normalizeSearch(search);
  const [rows, activeStoreOffers] = await Promise.all([
    getLatestRows(db, productIds),
    getActiveStoreOffers(db, normalizedSearch.coverage?.city),
  ]);
  const stores = new Map<string, {
    id: string;
    name: string;
    city: string;
    neighborhood: string;
    point?: GeoPoint;
    itemCount: number;
    activeOfferCount: number;
    totalCents: number;
    latestAt: string;
    confidenceSum: number;
    activeConfidence: number;
  }>();

  for (const row of activeStoreOffers) {
    stores.set(row.storeId, {
      id: row.storeId,
      name: row.storeName,
      city: row.storeCity,
      neighborhood: row.neighborhood,
      point: pointFromStore(row),
      itemCount: 0,
      activeOfferCount: row.activeOfferCount,
      totalCents: 0,
      latestAt: row.latestAt,
      confidenceSum: 0,
      activeConfidence: row.confidence,
    });
  }

  for (const row of rows) {
    const current = stores.get(row.storeId) ?? {
      id: row.storeId,
      name: row.storeName,
      city: row.storeCity,
      neighborhood: row.neighborhood,
      point: pointFromStore(row),
      itemCount: 0,
      activeOfferCount: 0,
      totalCents: 0,
      latestAt: row.observedAt,
      confidenceSum: 0,
      activeConfidence: row.confidence,
    };
    current.itemCount += 1;
    current.totalCents += row.priceCents;
    current.latestAt = current.latestAt > row.observedAt ? current.latestAt : row.observedAt;
    current.confidenceSum += row.confidence;
    stores.set(row.storeId, current);
  }

  const rankedStores = [...stores.values()]
    .filter((store) => store.activeOfferCount > 0 && (!normalizedSearch.coverage || store.city === normalizedSearch.coverage.city))
    .map((store) => {
      const calculatedDistance = normalizedSearch.location && store.point
        ? distanceInKm(normalizedSearch.location, store.point)
        : distanceByStoreId[store.id] ?? 0;
      return {
        ...store,
        distanceKm: Math.round(calculatedDistance * 10) / 10,
        coverage: productIds.length === 0 ? 0 : Math.round((store.itemCount / productIds.length) * 100),
        confidence: store.itemCount === 0 ? store.activeConfidence : Math.round(store.confidenceSum / store.itemCount),
      };
    })
    .filter((store) => !normalizedSearch.location || store.distanceKm <= normalizedSearch.radiusKm)
    .sort((left, right) => {
      const leftHasBasketItems = left.itemCount > 0;
      const rightHasBasketItems = right.itemCount > 0;
      if (leftHasBasketItems !== rightHasBasketItems) return leftHasBasketItems ? -1 : 1;
      if (normalizedSearch.sortBy === "distance") return left.distanceKm - right.distanceKm || right.activeOfferCount - left.activeOfferCount;
      if (!leftHasBasketItems) return right.activeOfferCount - left.activeOfferCount || left.distanceKm - right.distanceKm;
      return left.totalCents - right.totalCents || left.distanceKm - right.distanceKm;
    })
    .map((store) => ({
      id: store.id,
      name: store.name,
      city: store.city,
      neighborhood: store.neighborhood,
      itemCount: store.itemCount,
      activeOfferCount: store.activeOfferCount,
      totalCents: store.totalCents,
      latestAt: store.latestAt,
      distanceKm: store.distanceKm,
      coverage: store.coverage,
      confidence: store.confidence,
    }));

  return {
    city: normalizedSearch.coverage?.city ?? "Curitiba",
    requestedProductIds: productIds,
    search: {
      radiusKm: normalizedSearch.radiusKm,
      sortBy: normalizedSearch.sortBy,
      locationProvided: Boolean(normalizedSearch.location),
      coverageCity: normalizedSearch.coverage?.city ?? "Curitiba",
    },
    stores: rankedStores,
    generatedAt: new Date().toISOString(),
  };
}

export async function getOffers(db: D1Database, category?: string) {
  const products = category
    ? curitibaProducts.filter((product) => product.category === category)
    : curitibaProducts;
  const rows = await getLatestRows(db, products.map((product) => product.id));
  const bestByProduct = new Map<string, LatestPriceRow>();
  for (const row of rows) {
    const existing = bestByProduct.get(row.productId);
    if (!existing || row.priceCents < existing.priceCents) bestByProduct.set(row.productId, row);
  }

  return [...bestByProduct.values()]
    .map((row) => ({
      productId: row.productId,
      productName: row.productName,
      category: row.category,
      measure: row.measure,
      storeName: row.storeName,
      storeId: row.storeId,
      priceCents: row.priceCents,
      discountPercent: Math.max(0, Math.round((1 - row.priceCents / row.listPriceCents) * 100)),
      observedAt: row.observedAt,
      expiresAt: row.expiresAt,
      confidence: row.confidence,
    }))
    .sort((a, b) => b.discountPercent - a.discountPercent);
}

export async function getStoreOffers(db: D1Database, storeId: string, limit = 36) {
  const now = new Date().toISOString();
  const safeLimit = Math.max(1, Math.min(limit, 60));
  const query = `
    SELECT
      p.id AS productId, p.name AS productName, p.brand AS brand,
      p.category AS category, p.measure AS measure,
      po.price_cents AS priceCents, po.artifact_id AS artifactId,
      po.observed_at AS observedAt, po.expires_at AS expiresAt,
      po.confidence AS confidence
    FROM price_observations po
    INNER JOIN stores s ON s.id = po.store_id
    INNER JOIN products p ON p.id = po.product_id
    WHERE po.store_id = ?
      AND s.active = 1
      AND p.active = 1
      AND po.expires_at > ?
      AND po.observed_at <= ?
      AND po.observed_at = (
        SELECT MAX(latest.observed_at)
        FROM price_observations latest
        WHERE latest.store_id = po.store_id
          AND latest.product_id = po.product_id
          AND latest.expires_at > ?
          AND latest.observed_at <= ?
      )
    ORDER BY po.price_cents ASC, p.name ASC
    LIMIT ?
  `;
  const result = await db.prepare(query).bind(storeId, now, now, now, now, safeLimit).all<{
    productId: string;
    productName: string;
    brand: string;
    category: string;
    measure: string;
    priceCents: number;
    artifactId: string | null;
    observedAt: string;
    expiresAt: string;
    confidence: number;
  }>();
  return result.results ?? [];
}

export async function getPricingRadar(db: D1Database, anchorStoreId = "muffato-portao") {
  const rows = await getLatestRows(db, curitibaProducts.map((product) => product.id));
  const byProduct = new Map<string, LatestPriceRow[]>();
  for (const row of rows) byProduct.set(row.productId, [...(byProduct.get(row.productId) ?? []), row]);

  const alerts = [...byProduct.values()].flatMap((prices) => {
    const own = prices.find((price) => price.storeId === anchorStoreId);
    const competitor = prices.filter((price) => price.storeId !== anchorStoreId).sort((a, b) => a.priceCents - b.priceCents)[0];
    if (!own || !competitor) return [];
    const differencePercent = Math.round(((own.priceCents - competitor.priceCents) / own.priceCents) * 1000) / 10;
    return [{
      productId: own.productId,
      productName: own.productName,
      ownPriceCents: own.priceCents,
      competitorPriceCents: competitor.priceCents,
      competitorStoreName: competitor.storeName,
      differencePercent,
      status: differencePercent >= 5 ? "review" : "competitive",
      observedAt: own.observedAt,
    }];
  }).sort((a, b) => b.differencePercent - a.differencePercent);

  return {
    city: "Curitiba",
    anchorStore: curitibaStores.find((store) => store.id === anchorStoreId)?.name ?? "Loja de referência",
    coveragePercentage: rows.length === 0 ? 0 : Math.round((rows.length / (curitibaProducts.length * curitibaStores.length)) * 100),
    alerts,
    generatedAt: new Date().toISOString(),
  };
}

export async function isKnownStoreAndProduct(db: D1Database, storeId: string, productId: string) {
  const [store, product] = await db.batch([
    db.prepare("SELECT id FROM stores WHERE id = ? AND active = 1").bind(storeId),
    db.prepare("SELECT id FROM products WHERE id = ? AND active = 1").bind(productId),
  ]);
  return Boolean(store.results?.[0] && product.results?.[0]);
}

export async function createFeedback(db: D1Database, storeId: string, productId: string, reason: string) {
  const id = crypto.randomUUID();
  await db.prepare(
    "INSERT INTO consumer_feedback (id, store_id, product_id, reason, created_at, status) VALUES (?, ?, ?, ?, ?, 'open')",
  ).bind(id, storeId, productId, reason, new Date().toISOString()).run();
  return { id, status: "open" };
}

export async function importObservation(
  db: D1Database,
  input: {
    storeId: string;
    productId: string;
    priceCents: number;
    sourceType: ImportSourceType;
    sourceUrl?: string;
    expiresAt?: string;
    confidence?: number;
  },
) {
  const now = new Date();
  const artifactId = crypto.randomUUID();
  const observationId = crypto.randomUUID();
  const expiresAt = input.expiresAt ?? new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
  const confidence = Math.min(100, Math.max(0, Math.round(input.confidence ?? 85)));
  const artifactStatus = input.sourceType === "manual_review" ? "pending_review" : "received";
  await db.batch([
    db.prepare(
      "INSERT INTO source_artifacts (id, source_type, source_url, captured_at, checksum, status) VALUES (?, ?, ?, ?, ?, ?)",
    ).bind(artifactId, input.sourceType, input.sourceUrl ?? null, now.toISOString(), `import-${artifactId}`, artifactStatus),
    db.prepare(
      "INSERT INTO price_observations (id, store_id, product_id, artifact_id, price_cents, price_condition, observed_at, expires_at, confidence) VALUES (?, ?, ?, ?, ?, 'regular', ?, ?, ?)",
    ).bind(observationId, input.storeId, input.productId, artifactId, input.priceCents, now.toISOString(), expiresAt, confidence),
  ]);
  return { observationId, artifactId, expiresAt, confidence, sourceType: input.sourceType };
}
