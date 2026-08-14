import { curitibaProducts, curitibaStores } from "@/lib/curitiba-data";
import type { GeoPoint } from "@/lib/geo";

const POINTS_PER_VERIFIED_LABEL = 15;
const CONSENSUS_WINDOW_MS = 48 * 60 * 60 * 1_000;

type ContributorRow = {
  id: string;
  displayName: string;
  pointBalance: number;
  verifiedContributions: number;
  submissionCount: number;
  createdAt: string;
};

type ContributionInput = {
  id: string;
  contributorId: string;
  storeId: string;
  storeName: string;
  productId: string;
  imageKey: string;
  imageContentType: string;
  priceCents: number;
  location: GeoPoint;
};

function publicProfile(row: ContributorRow, position?: number) {
  return {
    id: row.id,
    displayName: row.displayName,
    pointBalance: row.pointBalance,
    verifiedContributions: row.verifiedContributions,
    submissionCount: row.submissionCount,
    position,
  };
}

async function getContributor(db: D1Database, contributorId: string) {
  return db.prepare(
    "SELECT id, display_name AS displayName, point_balance AS pointBalance, verified_contributions AS verifiedContributions, submission_count AS submissionCount, created_at AS createdAt FROM contributors WHERE id = ? AND active = 1",
  ).bind(contributorId).first<ContributorRow>();
}

export async function createContributor(db: D1Database, displayName: string) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.prepare(
    "INSERT INTO contributors (id, display_name, point_balance, verified_contributions, submission_count, created_at, active) VALUES (?, ?, 0, 0, 0, ?, 1)",
  ).bind(id, displayName, now).run();
  return { id, displayName, pointBalance: 0, verifiedContributions: 0, submissionCount: 0, position: undefined };
}

export async function getLeaderboard(db: D1Database) {
  const result = await db.prepare(
    "SELECT id, display_name AS displayName, point_balance AS pointBalance, verified_contributions AS verifiedContributions, submission_count AS submissionCount, created_at AS createdAt FROM contributors WHERE active = 1 ORDER BY point_balance DESC, verified_contributions DESC, created_at ASC LIMIT 10",
  ).all<ContributorRow>();
  return (result.results ?? []).map((row, index) => publicProfile(row, index + 1));
}

export async function getCommunitySummary(db: D1Database, contributorId: string) {
  const profile = await getContributor(db, contributorId);
  if (!profile) return undefined;
  const [higher, notifications, preferences] = await db.batch([
    db.prepare(
      "SELECT COUNT(*) AS count FROM contributors WHERE active = 1 AND (point_balance > ? OR (point_balance = ? AND verified_contributions > ?))",
    ).bind(profile.pointBalance, profile.pointBalance, profile.verifiedContributions),
    db.prepare(
      "SELECT id, type, title, body, created_at AS createdAt, read_at AS readAt FROM community_notifications WHERE contributor_id = ? ORDER BY created_at DESC LIMIT 6",
    ).bind(contributorId),
    db.prepare(
      "SELECT cpa.id, cpa.product_id AS productId, p.name AS productName, cpa.target_cents AS targetCents, cpa.active AS active FROM consumer_price_alerts cpa INNER JOIN products p ON p.id = cpa.product_id WHERE cpa.contributor_id = ? ORDER BY cpa.created_at DESC",
    ).bind(contributorId),
  ]);
  const higherCount = (higher.results?.[0] as { count?: number } | undefined)?.count ?? 0;
  return {
    profile: publicProfile(profile, Number(higherCount) + 1),
    leaderboard: await getLeaderboard(db),
    notifications: notifications.results ?? [],
    preferences: preferences.results ?? [],
  };
}

export async function createCommunityContribution(db: D1Database, input: ContributionInput) {
  const contributor = await getContributor(db, input.contributorId);
  if (!contributor) throw new Error("Participante não encontrado.");
  const now = new Date();
  await db.batch([
    db.prepare(
      "INSERT INTO community_contributions (id, contributor_id, store_id, store_name, product_id, image_key, image_content_type, price_cents, latitude, longitude, submitted_at, status, points_awarded) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0)",
    ).bind(
      input.id,
      input.contributorId,
      input.storeId,
      input.storeName,
      input.productId,
      input.imageKey,
      input.imageContentType,
      input.priceCents,
      Math.round(input.location.latitude * 1_000_000),
      Math.round(input.location.longitude * 1_000_000),
      now.toISOString(),
    ),
    db.prepare("UPDATE contributors SET submission_count = submission_count + 1 WHERE id = ?").bind(input.contributorId),
  ]);

  const verifiedContributionIds = await verifyMatchingContributions(db, input.storeName, input.productId, input.priceCents, now);
  const currentVerified = verifiedContributionIds.includes(input.id);
  return {
    id: input.id,
    status: currentVerified ? "verified" : "pending",
    pointsAwarded: currentVerified ? POINTS_PER_VERIFIED_LABEL : 0,
    awaiting: currentVerified ? undefined : "Uma segunda contribuição compatível confirma esta etiqueta.",
  };
}

async function verifyMatchingContributions(
  db: D1Database,
  storeName: string,
  productId: string,
  priceCents: number,
  now: Date,
) {
  const minimumSubmittedAt = new Date(now.getTime() - CONSENSUS_WINDOW_MS).toISOString();
  const result = await db.prepare(
    "SELECT id, contributor_id AS contributorId FROM community_contributions WHERE store_name = ? AND product_id = ? AND price_cents = ? AND status = 'pending' AND submitted_at >= ? ORDER BY submitted_at ASC",
  ).bind(storeName, productId, priceCents, minimumSubmittedAt).all<{ id: string; contributorId: string }>();
  const pending = result.results ?? [];
  if (new Set(pending.map((contribution) => contribution.contributorId)).size < 2) return [] as string[];

  const verifiedIds: string[] = [];
  for (const contribution of pending) {
    const updated = await db.prepare(
      "UPDATE community_contributions SET status = 'verified', points_awarded = ? WHERE id = ? AND status = 'pending'",
    ).bind(POINTS_PER_VERIFIED_LABEL, contribution.id).run();
    if ((updated.meta.changes ?? 0) === 0) continue;
    const notificationId = crypto.randomUUID();
    await db.batch([
      db.prepare(
        "UPDATE contributors SET point_balance = point_balance + ?, verified_contributions = verified_contributions + 1 WHERE id = ?",
      ).bind(POINTS_PER_VERIFIED_LABEL, contribution.contributorId),
      db.prepare(
        "INSERT OR IGNORE INTO community_notifications (id, contributor_id, type, title, body, dedupe_key, created_at, read_at) VALUES (?, ?, 'verification', 'Etiqueta validada', ?, ?, ?, NULL)",
      ).bind(
        notificationId,
        contribution.contributorId,
        `Você recebeu ${POINTS_PER_VERIFIED_LABEL} pontos porque outra pessoa confirmou o mesmo preço.`,
        `verified:${contribution.id}`,
        now.toISOString(),
      ),
    ]);
    verifiedIds.push(contribution.id);
  }
  return verifiedIds;
}

export async function savePriceAlertPreference(
  db: D1Database,
  contributorId: string,
  productId: string,
  targetCents: number,
) {
  if (!(await getContributor(db, contributorId))) throw new Error("Participante não encontrado.");
  await db.prepare(
    "INSERT INTO consumer_price_alerts (id, contributor_id, product_id, target_cents, active, created_at) VALUES (?, ?, ?, ?, 1, ?) ON CONFLICT(contributor_id, product_id) DO UPDATE SET target_cents = excluded.target_cents, active = 1",
  ).bind(crypto.randomUUID(), contributorId, productId, targetCents, new Date().toISOString()).run();
}

export async function markCommunityNotificationsRead(db: D1Database, contributorId: string) {
  await db.prepare(
    "UPDATE community_notifications SET read_at = ? WHERE contributor_id = ? AND read_at IS NULL",
  ).bind(new Date().toISOString(), contributorId).run();
}

export async function notifyPriceAlertSubscribers(
  db: D1Database,
  input: { storeId: string; productId: string; priceCents: number; expiresAt: string },
) {
  const result = await db.prepare(
    "SELECT contributor_id AS contributorId FROM consumer_price_alerts WHERE product_id = ? AND active = 1 AND target_cents >= ?",
  ).bind(input.productId, input.priceCents).all<{ contributorId: string }>();
  const product = curitibaProducts.find((item) => item.id === input.productId);
  const store = curitibaStores.find((item) => item.id === input.storeId);
  const dedupeKey = `price:${input.productId}:${input.storeId}:${input.priceCents}:${input.expiresAt.slice(0, 10)}`;
  const now = new Date().toISOString();
  const statements = (result.results ?? []).map((subscriber) => db.prepare(
    "INSERT OR IGNORE INTO community_notifications (id, contributor_id, type, title, body, dedupe_key, created_at, read_at) VALUES (?, ?, 'price_alert', ?, ?, ?, ?, NULL)",
  ).bind(
    crypto.randomUUID(),
    subscriber.contributorId,
    "Preço no alvo",
    `${product?.name ?? "Um produto monitorado"} atingiu seu preço no ${store?.name ?? "mercado monitorado"}.`,
    dedupeKey,
    now,
  ));
  if (statements.length > 0) await db.batch(statements);
  return statements.length;
}
