import type { PlatformIdentity, PlatformRole } from "@/lib/platform-auth";
import { env } from "cloudflare:workers";

export type PlatformAccount = PlatformIdentity & {
  role: PlatformRole;
  retailerStoreId: string | null;
  retailerStoreName: string | null;
  active: boolean;
};

export type RetailPlan = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  monthlyFlyerLimit: number;
  monthlyAiExtractionLimit: number;
  storeLimit: number;
  analyticsLevel: string;
  active: number;
};

export type FlyerCandidate = {
  id: string;
  productName: string;
  brand: string;
  category: string;
  measure: string;
  priceCents: number;
  validFrom: string | null;
  validUntil: string | null;
  confidence: number;
  status: string;
};

export type FlyerJob = {
  id: string;
  storeId: string;
  storeName: string;
  storeCity: string;
  storeNeighborhood: string;
  imageKey: string;
  originalFilename: string;
  imageContentType: string;
  status: string;
  aiModel: string | null;
  extractedCount: number;
  errorMessage: string | null;
  createdAt: string;
  analyzedAt: string | null;
  publishedAt: string | null;
};

function now() {
  return new Date().toISOString();
}

function readBootstrapAdminEmail() {
  return (env as typeof env & { ADMIN_BOOTSTRAP_EMAIL?: string }).ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
}

export async function getOrCreatePlatformAccount(db: D1Database, identity: PlatformIdentity) {
  const configuredAdmin = readBootstrapAdminEmail();
  const initialRole: PlatformRole = configuredAdmin && configuredAdmin === identity.email ? "admin" : "customer";
  const timestamp = now();
  await db.prepare(
    "INSERT OR IGNORE INTO platform_users (id, email, display_name, role, retailer_store_id, active, created_at, updated_at) VALUES (?, ?, ?, ?, NULL, 1, ?, ?)",
  ).bind(identity.id, identity.email, identity.displayName ?? null, initialRole, timestamp, timestamp).run();

  const result = await db.prepare(
    "SELECT u.id, u.email, u.display_name AS displayName, u.role, u.retailer_store_id AS retailerStoreId, u.active, s.name AS retailerStoreName FROM platform_users u LEFT JOIN stores s ON s.id = u.retailer_store_id WHERE u.id = ?",
  ).bind(identity.id).first<PlatformAccount>();
  if (!result || !result.active) throw new Error("Esta conta está desativada.");
  return result;
}

export async function requirePlatformRole(db: D1Database, identity: PlatformIdentity, roles: PlatformRole[]) {
  const account = await getOrCreatePlatformAccount(db, identity);
  if (!roles.includes(account.role)) throw new Error("Você não tem permissão para esta área.");
  return account;
}

export async function listRetailPlans(db: D1Database) {
  const result = await db.prepare(
    "SELECT id, name, description, price_cents AS priceCents, monthly_flyer_limit AS monthlyFlyerLimit, monthly_ai_extraction_limit AS monthlyAiExtractionLimit, store_limit AS storeLimit, analytics_level AS analyticsLevel, active FROM retail_plans WHERE active = 1 ORDER BY price_cents ASC",
  ).all<RetailPlan>();
  return result.results ?? [];
}

export async function listManagedStores(db: D1Database) {
  const result = await db.prepare(
    "SELECT id, name, city, neighborhood, latitude, longitude, active FROM stores WHERE active = 1 ORDER BY city, name",
  ).all<{ id: string; name: string; city: string; neighborhood: string; latitude: number | null; longitude: number | null; active: number }>();
  return result.results ?? [];
}

export async function createManagedStore(db: D1Database, input: { name: string; city: string; neighborhood: string; latitude?: number; longitude?: number }) {
  const id = `store-${crypto.randomUUID()}`;
  await db.prepare(
    "INSERT INTO stores (id, name, city, neighborhood, latitude, longitude, active) VALUES (?, ?, ?, ?, ?, ?, 1)",
  ).bind(
    id,
    input.name,
    input.city,
    input.neighborhood,
    input.latitude === undefined ? null : Math.round(input.latitude * 1_000_000),
    input.longitude === undefined ? null : Math.round(input.longitude * 1_000_000),
  ).run();
  return { id, ...input };
}

export async function assignPlatformUser(db: D1Database, input: { email: string; role: PlatformRole; retailerStoreId?: string | null }) {
  const timestamp = now();
  const normalizedEmail = input.email.trim().toLowerCase();
  const result = await db.prepare(
    "UPDATE platform_users SET role = ?, retailer_store_id = ?, updated_at = ? WHERE email = ?",
  ).bind(input.role, input.retailerStoreId ?? null, timestamp, normalizedEmail).run();
  if (!result.meta.changes) throw new Error("A pessoa precisa criar a conta antes de receber um papel.");
}

export async function createFlyerJob(db: D1Database, input: { id?: string; storeId: string; submittedByUserId: string; imageKey: string; imageContentType: string; originalFilename: string }) {
  const id = input.id ?? crypto.randomUUID();
  const createdAt = now();
  await db.prepare(
    "INSERT INTO flyer_ingestion_jobs (id, store_id, submitted_by_user_id, image_key, image_content_type, original_filename, status, created_at) VALUES (?, ?, ?, ?, ?, ?, 'queued', ?)",
  ).bind(id, input.storeId, input.submittedByUserId, input.imageKey, input.imageContentType, input.originalFilename, createdAt).run();
  return { id, createdAt };
}

export async function getFlyerJob(db: D1Database, jobId: string) {
  const job = await db.prepare(
    "SELECT j.id, j.store_id AS storeId, s.name AS storeName, s.city AS storeCity, s.neighborhood AS storeNeighborhood, j.image_key AS imageKey, j.original_filename AS originalFilename, j.image_content_type AS imageContentType, j.status, j.ai_model AS aiModel, j.extracted_count AS extractedCount, j.error_message AS errorMessage, j.created_at AS createdAt, j.analyzed_at AS analyzedAt, j.published_at AS publishedAt FROM flyer_ingestion_jobs j INNER JOIN stores s ON s.id = j.store_id WHERE j.id = ?",
  ).bind(jobId).first<FlyerJob>();
  return job ?? null;
}

export async function listFlyerJobs(db: D1Database, storeId?: string) {
  const condition = storeId ? "WHERE j.store_id = ?" : "";
  const result = await db.prepare(
    `SELECT j.id, j.store_id AS storeId, s.name AS storeName, s.city AS storeCity, s.neighborhood AS storeNeighborhood, j.image_key AS imageKey, j.original_filename AS originalFilename, j.image_content_type AS imageContentType, j.status, j.ai_model AS aiModel, j.extracted_count AS extractedCount, j.error_message AS errorMessage, j.created_at AS createdAt, j.analyzed_at AS analyzedAt, j.published_at AS publishedAt FROM flyer_ingestion_jobs j INNER JOIN stores s ON s.id = j.store_id ${condition} ORDER BY j.created_at DESC LIMIT 30`,
  ).bind(...(storeId ? [storeId] : [])).all<FlyerJob>();
  return result.results ?? [];
}

export async function listFlyerCandidates(db: D1Database, jobId: string) {
  const result = await db.prepare(
    "SELECT id, product_name AS productName, brand, category, measure, price_cents AS priceCents, valid_from AS validFrom, valid_until AS validUntil, confidence, status FROM flyer_offer_candidates WHERE job_id = ? ORDER BY price_cents ASC, product_name ASC",
  ).bind(jobId).all<FlyerCandidate>();
  return result.results ?? [];
}

export async function saveFlyerCandidates(db: D1Database, jobId: string, candidates: Omit<FlyerCandidate, "id" | "status">[], model: string) {
  const createdAt = now();
  const commands = [
    db.prepare("DELETE FROM flyer_offer_candidates WHERE job_id = ? AND status = 'pending_review'").bind(jobId),
    ...candidates.map((candidate) => db.prepare(
      "INSERT INTO flyer_offer_candidates (id, job_id, product_name, brand, category, measure, price_cents, valid_from, valid_until, confidence, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_review', ?)",
    ).bind(crypto.randomUUID(), jobId, candidate.productName, candidate.brand, candidate.category, candidate.measure, candidate.priceCents, candidate.validFrom, candidate.validUntil, candidate.confidence, createdAt)),
    db.prepare("UPDATE flyer_ingestion_jobs SET status = 'pending_review', ai_model = ?, extracted_count = ?, error_message = NULL, analyzed_at = ? WHERE id = ?").bind(model, candidates.length, createdAt, jobId),
  ];
  await db.batch(commands);
}

export async function markFlyerFailure(db: D1Database, jobId: string, message: string) {
  await db.prepare("UPDATE flyer_ingestion_jobs SET status = 'failed', error_message = ? WHERE id = ?").bind(message.slice(0, 400), jobId).run();
}

export async function getPlatformOverview(db: D1Database) {
  const [users, retailers, stores, jobs, pending] = await db.batch([
    db.prepare("SELECT COUNT(*) AS count FROM platform_users WHERE active = 1"),
    db.prepare("SELECT COUNT(*) AS count FROM platform_users WHERE role = 'retailer' AND active = 1"),
    db.prepare("SELECT COUNT(*) AS count FROM stores WHERE active = 1"),
    db.prepare("SELECT COUNT(*) AS count FROM flyer_ingestion_jobs WHERE status IN ('queued', 'processing', 'pending_review')"),
    db.prepare("SELECT COUNT(*) AS count FROM flyer_offer_candidates WHERE status = 'pending_review'"),
  ]);
  const count = (result: D1Result<{ count: number }>) => Number(result.results?.[0]?.count ?? 0);
  return { activeUsers: count(users), retailers: count(retailers), stores: count(stores), openFlyerJobs: count(jobs), offersAwaitingReview: count(pending) };
}

export async function getRetailerDashboard(db: D1Database, account: PlatformAccount) {
  if (!account.retailerStoreId) throw new Error("Associe esta conta a uma loja para abrir o painel do varejista.");
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [subscription, flyerUsage] = await db.batch([
    db.prepare("SELECT s.id, s.status, s.provider, s.current_period_end AS currentPeriodEnd, p.id AS planId, p.name AS planName, p.price_cents AS priceCents, p.monthly_flyer_limit AS monthlyFlyerLimit, p.monthly_ai_extraction_limit AS monthlyAiExtractionLimit, p.analytics_level AS analyticsLevel FROM retailer_subscriptions s INNER JOIN retail_plans p ON p.id = s.plan_id WHERE s.retailer_user_id = ? ORDER BY s.updated_at DESC LIMIT 1").bind(account.id),
    db.prepare("SELECT COUNT(*) AS count FROM flyer_ingestion_jobs WHERE submitted_by_user_id = ? AND substr(created_at, 1, 7) = ?").bind(account.id, currentMonth),
  ]);
  const plan = subscription.results?.[0] ?? null;
  const flyersThisMonth = Number(flyerUsage.results?.[0]?.count ?? 0);
  return { storeId: account.retailerStoreId, storeName: account.retailerStoreName, subscription: plan, flyersThisMonth };
}

export async function createPendingSubscription(db: D1Database, retailerUserId: string, planId: string) {
  const id = crypto.randomUUID();
  const timestamp = now();
  await db.prepare(
    "INSERT INTO retailer_subscriptions (id, retailer_user_id, plan_id, status, provider, provider_reference, current_period_end, created_at, updated_at) VALUES (?, ?, ?, 'pending', 'mercado_pago', NULL, NULL, ?, ?)",
  ).bind(id, retailerUserId, planId, timestamp, timestamp).run();
  return id;
}

export async function attachSubscriptionReference(db: D1Database, subscriptionId: string, reference: string) {
  await db.prepare("UPDATE retailer_subscriptions SET provider_reference = ?, updated_at = ? WHERE id = ?").bind(reference, now(), subscriptionId).run();
}
