CREATE TABLE `consumer_feedback` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`product_id` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `price_alerts` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`product_id` text NOT NULL,
	`competitor_price_cents` integer NOT NULL,
	`own_price_cents` integer NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `price_observations` (
	`id` text PRIMARY KEY NOT NULL,
	`store_id` text NOT NULL,
	`product_id` text NOT NULL,
	`artifact_id` text,
	`price_cents` integer NOT NULL,
	`price_condition` text DEFAULT 'regular' NOT NULL,
	`observed_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`confidence` integer NOT NULL,
	FOREIGN KEY (`store_id`) REFERENCES `stores`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`artifact_id`) REFERENCES `source_artifacts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_price_observations_store_product_observed` ON `price_observations` (`store_id`,`product_id`,`observed_at`);--> statement-breakpoint
CREATE INDEX `idx_price_observations_product_expires` ON `price_observations` (`product_id`,`expires_at`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`gtin` text,
	`name` text NOT NULL,
	`brand` text NOT NULL,
	`category` text NOT NULL,
	`measure` text NOT NULL,
	`list_price_cents` integer NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `source_artifacts` (
	`id` text PRIMARY KEY NOT NULL,
	`source_type` text NOT NULL,
	`source_url` text,
	`captured_at` text NOT NULL,
	`checksum` text NOT NULL,
	`status` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `stores` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`city` text NOT NULL,
	`neighborhood` text NOT NULL,
	`latitude` integer,
	`longitude` integer,
	`active` integer DEFAULT true NOT NULL
);
