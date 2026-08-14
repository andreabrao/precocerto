CREATE TABLE `community_contributions` (
	`id` text PRIMARY KEY NOT NULL,
	`contributor_id` text NOT NULL,
	`store_id` text NOT NULL,
	`product_id` text NOT NULL,
	`image_key` text NOT NULL,
	`image_content_type` text NOT NULL,
	`price_cents` integer NOT NULL,
	`latitude` integer NOT NULL,
	`longitude` integer NOT NULL,
	`submitted_at` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`points_awarded` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`contributor_id`) REFERENCES `contributors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_contributions_status_submitted` ON `community_contributions` (`status`,`submitted_at`);--> statement-breakpoint
CREATE INDEX `idx_contributions_store_product_price_submitted` ON `community_contributions` (`store_id`,`product_id`,`price_cents`,`submitted_at`);--> statement-breakpoint
CREATE TABLE `community_notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`contributor_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`dedupe_key` text NOT NULL,
	`created_at` text NOT NULL,
	`read_at` text,
	FOREIGN KEY (`contributor_id`) REFERENCES `contributors`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_notifications_contributor_dedupe` ON `community_notifications` (`contributor_id`,`dedupe_key`);--> statement-breakpoint
CREATE INDEX `idx_notifications_contributor_created` ON `community_notifications` (`contributor_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `consumer_price_alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`contributor_id` text NOT NULL,
	`product_id` text NOT NULL,
	`target_cents` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`contributor_id`) REFERENCES `contributors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_alert_preferences_contributor_product` ON `consumer_price_alerts` (`contributor_id`,`product_id`);--> statement-breakpoint
CREATE INDEX `idx_alert_preferences_product_target_active` ON `consumer_price_alerts` (`product_id`,`target_cents`,`active`);--> statement-breakpoint
CREATE TABLE `contributors` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`point_balance` integer DEFAULT 0 NOT NULL,
	`verified_contributions` integer DEFAULT 0 NOT NULL,
	`submission_count` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
