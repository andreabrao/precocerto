import { communityCollectionStores, curitibaProducts, curitibaStores, seedPriceObservations } from "@/lib/curitiba-data";
import { rioVerdeFlyerArtifacts, rioVerdeFlyerItems, rioVerdeItaperucuStore } from "@/lib/rio-verde-flyer";
import { itaperucuSocialArtifacts, itaperucuSocialOffers, itaperucuSocialStores } from "@/lib/itaperucu-social-offers";

let initialization: Promise<void> | undefined;

const schemaStatements = [
  "CREATE TABLE IF NOT EXISTS stores (id TEXT PRIMARY KEY, name TEXT NOT NULL, city TEXT NOT NULL, neighborhood TEXT NOT NULL, latitude INTEGER, longitude INTEGER, active INTEGER NOT NULL DEFAULT 1)",
  "CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, gtin TEXT, name TEXT NOT NULL, brand TEXT NOT NULL, category TEXT NOT NULL, measure TEXT NOT NULL, list_price_cents INTEGER NOT NULL, active INTEGER NOT NULL DEFAULT 1)",
  "CREATE TABLE IF NOT EXISTS source_artifacts (id TEXT PRIMARY KEY, source_type TEXT NOT NULL, source_url TEXT, captured_at TEXT NOT NULL, checksum TEXT NOT NULL, status TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS price_observations (id TEXT PRIMARY KEY, store_id TEXT NOT NULL, product_id TEXT NOT NULL, artifact_id TEXT, price_cents INTEGER NOT NULL, price_condition TEXT NOT NULL DEFAULT 'regular', observed_at TEXT NOT NULL, expires_at TEXT NOT NULL, confidence INTEGER NOT NULL, FOREIGN KEY(store_id) REFERENCES stores(id), FOREIGN KEY(product_id) REFERENCES products(id), FOREIGN KEY(artifact_id) REFERENCES source_artifacts(id))",
  "CREATE TABLE IF NOT EXISTS price_alerts (id TEXT PRIMARY KEY, store_id TEXT NOT NULL, product_id TEXT NOT NULL, competitor_price_cents INTEGER NOT NULL, own_price_cents INTEGER NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, FOREIGN KEY(store_id) REFERENCES stores(id), FOREIGN KEY(product_id) REFERENCES products(id))",
  "CREATE TABLE IF NOT EXISTS consumer_feedback (id TEXT PRIMARY KEY, store_id TEXT NOT NULL, product_id TEXT NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', FOREIGN KEY(store_id) REFERENCES stores(id), FOREIGN KEY(product_id) REFERENCES products(id))",
  "CREATE TABLE IF NOT EXISTS contributors (id TEXT PRIMARY KEY, display_name TEXT NOT NULL, point_balance INTEGER NOT NULL DEFAULT 0, verified_contributions INTEGER NOT NULL DEFAULT 0, submission_count INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL, active INTEGER NOT NULL DEFAULT 1)",
  "CREATE TABLE IF NOT EXISTS community_contributions (id TEXT PRIMARY KEY, contributor_id TEXT NOT NULL, store_id TEXT NOT NULL, store_name TEXT NOT NULL, product_id TEXT NOT NULL, image_key TEXT NOT NULL, image_content_type TEXT NOT NULL, price_cents INTEGER NOT NULL, latitude INTEGER NOT NULL, longitude INTEGER NOT NULL, submitted_at TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', points_awarded INTEGER NOT NULL DEFAULT 0, FOREIGN KEY(contributor_id) REFERENCES contributors(id), FOREIGN KEY(store_id) REFERENCES stores(id), FOREIGN KEY(product_id) REFERENCES products(id))",
  "CREATE TABLE IF NOT EXISTS consumer_price_alerts (id TEXT PRIMARY KEY, contributor_id TEXT NOT NULL, product_id TEXT NOT NULL, target_cents INTEGER NOT NULL, active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, FOREIGN KEY(contributor_id) REFERENCES contributors(id), FOREIGN KEY(product_id) REFERENCES products(id), UNIQUE(contributor_id, product_id))",
  "CREATE TABLE IF NOT EXISTS community_notifications (id TEXT PRIMARY KEY, contributor_id TEXT NOT NULL, type TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, dedupe_key TEXT NOT NULL, created_at TEXT NOT NULL, read_at TEXT, FOREIGN KEY(contributor_id) REFERENCES contributors(id), UNIQUE(contributor_id, dedupe_key))",
  "CREATE INDEX IF NOT EXISTS idx_price_observations_store_product_observed ON price_observations(store_id, product_id, observed_at)",
  "CREATE INDEX IF NOT EXISTS idx_price_observations_product_expires ON price_observations(product_id, expires_at)",
  "CREATE INDEX IF NOT EXISTS idx_contributions_status_submitted ON community_contributions(status, submitted_at)",
  "CREATE INDEX IF NOT EXISTS idx_alert_preferences_product_target_active ON consumer_price_alerts(product_id, target_cents, active)",
  "CREATE INDEX IF NOT EXISTS idx_notifications_contributor_created ON community_notifications(contributor_id, created_at)",
];

export function ensureCuritibaDatabase(db: D1Database) {
  initialization ??= setupDatabase(db);
  return initialization;
}

async function setupDatabase(db: D1Database) {
  await db.batch(schemaStatements.map((statement) => db.prepare(statement)));
  await ensureCommunityContributionColumns(db);
  await db.prepare("PRAGMA optimize").run();
  const observedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const artifactCapturedAt = new Map(rioVerdeFlyerArtifacts.map((artifact) => [artifact.id, artifact.capturedAt]));
  const commands = [
    ...communityCollectionStores.map((store) => db.prepare(
      "INSERT OR IGNORE INTO stores (id, name, city, neighborhood, latitude, longitude, active) VALUES (?, ?, ?, ?, ?, ?, 1)",
    ).bind(store.id, store.name, store.city, store.neighborhood, Math.round(store.latitude * 1_000_000), Math.round(store.longitude * 1_000_000))),
    ...curitibaStores.map((store) => db.prepare(
      "INSERT OR IGNORE INTO stores (id, name, city, neighborhood, latitude, longitude, active) VALUES (?, ?, 'Curitiba', ?, ?, ?, 1)",
    ).bind(store.id, store.name, store.neighborhood, Math.round(store.latitude * 1_000_000), Math.round(store.longitude * 1_000_000))),
    ...curitibaProducts.map((product) => db.prepare(
      "INSERT OR IGNORE INTO products (id, gtin, name, brand, category, measure, list_price_cents, active) VALUES (?, NULL, ?, ?, ?, ?, ?, 1)",
    ).bind(product.id, product.name, product.brand, product.category, product.measure, product.listPriceCents)),
    ...curitibaStores.map((store) => db.prepare(
      "INSERT OR IGNORE INTO source_artifacts (id, source_type, source_url, captured_at, checksum, status) VALUES (?, 'seed', NULL, ?, ?, 'verified')",
    ).bind(`seed-source-${store.id}`, observedAt, `seed-${store.id}`)),
    ...seedPriceObservations.map((observation) => db.prepare(
      "INSERT OR IGNORE INTO price_observations (id, store_id, product_id, artifact_id, price_cents, price_condition, observed_at, expires_at, confidence) VALUES (?, ?, ?, ?, ?, 'regular', ?, ?, 100)",
    ).bind(observation.id, observation.storeId, observation.productId, `seed-source-${observation.storeId}`, observation.priceCents, observedAt, expiresAt)),
    db.prepare(
      "INSERT OR IGNORE INTO stores (id, name, city, neighborhood, latitude, longitude, active) VALUES (?, ?, ?, ?, ?, ?, 1)",
    ).bind(
      rioVerdeItaperucuStore.id,
      rioVerdeItaperucuStore.name,
      rioVerdeItaperucuStore.city,
      rioVerdeItaperucuStore.neighborhood,
      Math.round(rioVerdeItaperucuStore.latitude * 1_000_000),
      Math.round(rioVerdeItaperucuStore.longitude * 1_000_000),
    ),
    ...rioVerdeFlyerItems.map((flyerItem) => db.prepare(
      "INSERT OR IGNORE INTO products (id, gtin, name, brand, category, measure, list_price_cents, active) VALUES (?, NULL, ?, ?, ?, ?, ?, 1)",
    ).bind(flyerItem.id, flyerItem.name, flyerItem.brand, flyerItem.category, flyerItem.measure, flyerItem.priceCents)),
    ...rioVerdeFlyerArtifacts.map((artifact) => db.prepare(
      "INSERT OR IGNORE INTO source_artifacts (id, source_type, source_url, captured_at, checksum, status) VALUES (?, 'official_flyer', NULL, ?, ?, 'verified')",
    ).bind(artifact.id, artifact.capturedAt, artifact.checksum)),
    ...rioVerdeFlyerItems.map((flyerItem) => db.prepare(
      "INSERT OR IGNORE INTO price_observations (id, store_id, product_id, artifact_id, price_cents, price_condition, observed_at, expires_at, confidence) VALUES (?, ?, ?, ?, ?, 'flyer', ?, ?, 95)",
    ).bind(
      `rio-verde-observation-${flyerItem.id}`,
      rioVerdeItaperucuStore.id,
      flyerItem.id,
      flyerItem.artifactId,
      flyerItem.priceCents,
      artifactCapturedAt.get(flyerItem.artifactId) ?? observedAt,
      flyerItem.expiresAt,
    )),
    ...itaperucuSocialStores.map((store) => db.prepare(
      "INSERT OR IGNORE INTO stores (id, name, city, neighborhood, latitude, longitude, active) VALUES (?, ?, ?, ?, ?, ?, 1)",
    ).bind(store.id, store.name, store.city, store.neighborhood, Math.round(store.latitude * 1_000_000), Math.round(store.longitude * 1_000_000))),
    ...itaperucuSocialOffers.map((socialOffer) => db.prepare(
      "INSERT OR IGNORE INTO products (id, gtin, name, brand, category, measure, list_price_cents, active) VALUES (?, NULL, ?, ?, ?, ?, ?, 1)",
    ).bind(socialOffer.id, socialOffer.name, socialOffer.brand, socialOffer.category, socialOffer.measure, socialOffer.priceCents)),
    ...itaperucuSocialArtifacts.map((artifact) => db.prepare(
      "INSERT OR IGNORE INTO source_artifacts (id, source_type, source_url, captured_at, checksum, status) VALUES (?, 'official_social_post', NULL, ?, ?, 'received')",
    ).bind(artifact.id, artifact.capturedAt, artifact.checksum)),
    ...itaperucuSocialOffers.map((socialOffer) => db.prepare(
      "INSERT OR IGNORE INTO price_observations (id, store_id, product_id, artifact_id, price_cents, price_condition, observed_at, expires_at, confidence) VALUES (?, ?, ?, ?, ?, 'social_offer', ?, ?, 90)",
    ).bind(
      `social-observation-${socialOffer.id}`,
      socialOffer.storeId,
      socialOffer.id,
      socialOffer.artifactId,
      socialOffer.priceCents,
      socialOffer.startsAt,
      socialOffer.expiresAt,
    )),
  ];
  await db.batch(commands);
}

async function ensureCommunityContributionColumns(db: D1Database) {
  const columns = await db.prepare("PRAGMA table_info(community_contributions)").all<{ name: string }>();
  if (!(columns.results ?? []).some((column) => column.name === "store_name")) {
    await db.prepare("ALTER TABLE community_contributions ADD COLUMN store_name TEXT NOT NULL DEFAULT ''").run();
  }
  await db.prepare(
    "CREATE INDEX IF NOT EXISTS idx_contributions_store_name_product_price_submitted ON community_contributions(store_name, product_id, price_cents, submitted_at)",
  ).run();
}
