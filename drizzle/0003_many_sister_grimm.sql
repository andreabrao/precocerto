CREATE TABLE `flyer_ingestion_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`submitted_by_user_id` text NOT NULL,
	`image_key` text NOT NULL,
	`image_content_type` text NOT NULL,
	`original_filename` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`ai_model` text,
	`extracted_count` integer DEFAULT 0 NOT NULL,
	`error_message` text,
	`created_at` text NOT NULL,
	`analyzed_at` text,
	`published_at` text,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`submitted_by_user_id`) REFERENCES `platform_users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_flyer_jobs_store_status_created` ON `flyer_ingestion_jobs` (`store_id`,`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_flyer_jobs_submitter_created` ON `flyer_ingestion_jobs` (`submitted_by_user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `flyer_offer_candidates` (
	`id` text PRIMARY KEY NOT NULL,
	`job_id` text NOT NULL,
	`product_name` text NOT NULL,
	`brand` text NOT NULL,
	`category` text NOT NULL,
	`measure` text NOT NULL,
	`price_cents` integer NOT NULL,
	`valid_from` text,
	`valid_until` text,
	`confidence` integer NOT NULL,
	`status` text DEFAULT 'pending_review' NOT NULL,
	`created_at` text NOT NULL,
	`published_observation_id` text,
	FOREIGN KEY (`job_id`) REFERENCES `flyer_ingestion_jobs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_flyer_candidates_job_status` ON `flyer_offer_candidates` (`job_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_flyer_candidates_status_created` ON `flyer_offer_candidates` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `platform_users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text,
	`role` text DEFAULT 'customer' NOT NULL,
	`retailer_store_id` text,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`retailer_store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_platform_users_email` ON `platform_users` (`email`);--> statement-breakpoint
CREATE INDEX `idx_platform_users_role_active` ON `platform_users` (`role`,`active`);--> statement-breakpoint
CREATE INDEX `idx_platform_users_retailer_store` ON `platform_users` (`retailer_store_id`);--> statement-breakpoint
CREATE TABLE `retail_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`price_cents` integer NOT NULL,
	`monthly_flyer_limit` integer NOT NULL,
	`monthly_ai_extraction_limit` integer NOT NULL,
	`store_limit` integer NOT NULL,
	`analytics_level` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `retailer_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`retailer_user_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`provider` text DEFAULT 'mercado_pago' NOT NULL,
	`provider_reference` text,
	`current_period_end` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`retailer_user_id`) REFERENCES `platform_users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`plan_id`) REFERENCES `retail_plans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_subscriptions_retailer_status` ON `retailer_subscriptions` (`retailer_user_id`,`status`);--> statement-breakpoint
CREATE INDEX `idx_subscriptions_plan_status` ON `retailer_subscriptions` (`plan_id`,`status`);