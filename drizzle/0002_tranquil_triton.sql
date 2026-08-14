DROP INDEX `idx_contributions_store_product_price_submitted`;--> statement-breakpoint
ALTER TABLE `community_contributions` ADD `store_name` text NOT NULL DEFAULT '';--> statement-breakpoint
CREATE INDEX `idx_contributions_store_name_product_price_submitted` ON `community_contributions` (`store_name`,`product_id`,`price_cents`,`submitted_at`);
