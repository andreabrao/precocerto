import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const stores = sqliteTable("stores", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  city: text("city").notNull(),
  neighborhood: text("neighborhood").notNull(),
  latitude: integer("latitude"),
  longitude: integer("longitude"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

export const products = sqliteTable("products", {
  id: text("id").primaryKey(),
  gtin: text("gtin"),
  name: text("name").notNull(),
  brand: text("brand").notNull(),
  category: text("category").notNull(),
  measure: text("measure").notNull(),
  listPriceCents: integer("list_price_cents").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

export const sourceArtifacts = sqliteTable("source_artifacts", {
  id: text("id").primaryKey(),
  sourceType: text("source_type").notNull(),
  sourceUrl: text("source_url"),
  capturedAt: text("captured_at").notNull(),
  checksum: text("checksum").notNull(),
  status: text("status").notNull(),
});

export const priceObservations = sqliteTable(
  "price_observations",
  {
    id: text("id").primaryKey(),
    storeId: text("store_id").notNull().references(() => stores.id),
    productId: text("product_id").notNull().references(() => products.id),
    artifactId: text("artifact_id").references(() => sourceArtifacts.id),
    priceCents: integer("price_cents").notNull(),
    priceCondition: text("price_condition").notNull().default("regular"),
    observedAt: text("observed_at").notNull(),
    expiresAt: text("expires_at").notNull(),
    confidence: integer("confidence").notNull(),
  },
  (table) => [
    index("idx_price_observations_store_product_observed").on(table.storeId, table.productId, table.observedAt),
    index("idx_price_observations_product_expires").on(table.productId, table.expiresAt),
  ],
);

export const priceAlerts = sqliteTable("price_alerts", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull().references(() => stores.id),
  productId: text("product_id").notNull().references(() => products.id),
  competitorPriceCents: integer("competitor_price_cents").notNull(),
  ownPriceCents: integer("own_price_cents").notNull(),
  status: text("status").notNull(),
  createdAt: text("created_at").notNull(),
});

export const consumerFeedback = sqliteTable("consumer_feedback", {
  id: text("id").primaryKey(),
  storeId: text("store_id").notNull().references(() => stores.id),
  productId: text("product_id").notNull().references(() => products.id),
  reason: text("reason").notNull(),
  createdAt: text("created_at").notNull(),
  status: text("status").notNull().default("open"),
});

export const contributors = sqliteTable("contributors", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  pointBalance: integer("point_balance").notNull().default(0),
  verifiedContributions: integer("verified_contributions").notNull().default(0),
  submissionCount: integer("submission_count").notNull().default(0),
  createdAt: text("created_at").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

export const communityContributions = sqliteTable(
  "community_contributions",
  {
    id: text("id").primaryKey(),
    contributorId: text("contributor_id").notNull().references(() => contributors.id),
    storeId: text("store_id").notNull().references(() => stores.id),
    storeName: text("store_name").notNull(),
    productId: text("product_id").notNull().references(() => products.id),
    imageKey: text("image_key").notNull(),
    imageContentType: text("image_content_type").notNull(),
    priceCents: integer("price_cents").notNull(),
    latitude: integer("latitude").notNull(),
    longitude: integer("longitude").notNull(),
    submittedAt: text("submitted_at").notNull(),
    status: text("status").notNull().default("pending"),
    pointsAwarded: integer("points_awarded").notNull().default(0),
  },
  (table) => [
    index("idx_contributions_status_submitted").on(table.status, table.submittedAt),
    index("idx_contributions_store_name_product_price_submitted").on(table.storeName, table.productId, table.priceCents, table.submittedAt),
  ],
);

export const consumerPriceAlerts = sqliteTable(
  "consumer_price_alerts",
  {
    id: text("id").primaryKey(),
    contributorId: text("contributor_id").notNull().references(() => contributors.id),
    productId: text("product_id").notNull().references(() => products.id),
    targetCents: integer("target_cents").notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    uniqueIndex("idx_alert_preferences_contributor_product").on(table.contributorId, table.productId),
    index("idx_alert_preferences_product_target_active").on(table.productId, table.targetCents, table.active),
  ],
);

export const communityNotifications = sqliteTable(
  "community_notifications",
  {
    id: text("id").primaryKey(),
    contributorId: text("contributor_id").notNull().references(() => contributors.id),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    dedupeKey: text("dedupe_key").notNull(),
    createdAt: text("created_at").notNull(),
    readAt: text("read_at"),
  },
  (table) => [
    uniqueIndex("idx_notifications_contributor_dedupe").on(table.contributorId, table.dedupeKey),
    index("idx_notifications_contributor_created").on(table.contributorId, table.createdAt),
  ],
);

export const platformUsers = sqliteTable(
  "platform_users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    displayName: text("display_name"),
    role: text("role").notNull().default("customer"),
    retailerStoreId: text("retailer_store_id").references(() => stores.id),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("idx_platform_users_email").on(table.email),
    index("idx_platform_users_role_active").on(table.role, table.active),
    index("idx_platform_users_retailer_store").on(table.retailerStoreId),
  ],
);

export const retailPlans = sqliteTable("retail_plans", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  priceCents: integer("price_cents").notNull(),
  monthlyFlyerLimit: integer("monthly_flyer_limit").notNull(),
  monthlyAiExtractionLimit: integer("monthly_ai_extraction_limit").notNull(),
  storeLimit: integer("store_limit").notNull(),
  analyticsLevel: text("analytics_level").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const retailerSubscriptions = sqliteTable(
  "retailer_subscriptions",
  {
    id: text("id").primaryKey(),
    retailerUserId: text("retailer_user_id").notNull().references(() => platformUsers.id),
    planId: text("plan_id").notNull().references(() => retailPlans.id),
    status: text("status").notNull().default("pending"),
    provider: text("provider").notNull().default("mercado_pago"),
    providerReference: text("provider_reference"),
    currentPeriodEnd: text("current_period_end"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("idx_subscriptions_retailer_status").on(table.retailerUserId, table.status),
    index("idx_subscriptions_plan_status").on(table.planId, table.status),
  ],
);

export const flyerIngestionJobs = sqliteTable(
  "flyer_ingestion_jobs",
  {
    id: text("id").primaryKey(),
    storeId: text("store_id").notNull().references(() => stores.id),
    submittedByUserId: text("submitted_by_user_id").notNull().references(() => platformUsers.id),
    imageKey: text("image_key").notNull(),
    imageContentType: text("image_content_type").notNull(),
    originalFilename: text("original_filename").notNull(),
    status: text("status").notNull().default("queued"),
    aiModel: text("ai_model"),
    extractedCount: integer("extracted_count").notNull().default(0),
    errorMessage: text("error_message"),
    createdAt: text("created_at").notNull(),
    analyzedAt: text("analyzed_at"),
    publishedAt: text("published_at"),
  },
  (table) => [
    index("idx_flyer_jobs_store_status_created").on(table.storeId, table.status, table.createdAt),
    index("idx_flyer_jobs_submitter_created").on(table.submittedByUserId, table.createdAt),
  ],
);

export const flyerOfferCandidates = sqliteTable(
  "flyer_offer_candidates",
  {
    id: text("id").primaryKey(),
    jobId: text("job_id").notNull().references(() => flyerIngestionJobs.id),
    productName: text("product_name").notNull(),
    brand: text("brand").notNull(),
    category: text("category").notNull(),
    measure: text("measure").notNull(),
    priceCents: integer("price_cents").notNull(),
    validFrom: text("valid_from"),
    validUntil: text("valid_until"),
    confidence: integer("confidence").notNull(),
    status: text("status").notNull().default("pending_review"),
    createdAt: text("created_at").notNull(),
    publishedObservationId: text("published_observation_id"),
  },
  (table) => [
    index("idx_flyer_candidates_job_status").on(table.jobId, table.status),
    index("idx_flyer_candidates_status_created").on(table.status, table.createdAt),
  ],
);
