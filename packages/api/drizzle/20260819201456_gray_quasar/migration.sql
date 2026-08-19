CREATE TABLE `quote_lines` (
	`id` text PRIMARY KEY,
	`revision_id` text NOT NULL,
	`position` integer NOT NULL,
	`description` text NOT NULL,
	`quantity_milli` integer NOT NULL,
	`unit_price_cents` integer NOT NULL,
	`vat_rate_basis_points` integer NOT NULL,
	`net_total_cents` integer NOT NULL,
	`vat_total_cents` integer NOT NULL,
	`total_cents` integer NOT NULL,
	CONSTRAINT `fk_quote_lines_revision_id_quote_revisions_id_fk` FOREIGN KEY (`revision_id`) REFERENCES `quote_revisions`(`id`) ON DELETE CASCADE,
	CONSTRAINT "quote_lines_id_ulid_check" CHECK("id" is not null and length("id") = 26 and "id" not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr("id", 1, 1) between '0' and '7'),
	CONSTRAINT "quote_lines_position_check" CHECK("position" between 0 and 19),
	CONSTRAINT "quote_lines_description_check" CHECK(length(trim("description")) between 1 and 160),
	CONSTRAINT "quote_lines_input_check" CHECK("quantity_milli" between 1 and 9007199254740991 and "unit_price_cents" between 0 and 9007199254740991 and "vat_rate_basis_points" between 0 and 10000),
	CONSTRAINT "quote_lines_totals_check" CHECK("net_total_cents" between 0 and 9007199254740991 and "vat_total_cents" between 0 and 9007199254740991 and "total_cents" between 0 and 9007199254740991 and "total_cents" = "net_total_cents" + "vat_total_cents")
);
--> statement-breakpoint
CREATE TABLE `quote_revisions` (
	`id` text PRIMARY KEY,
	`quote_id` text NOT NULL,
	`version` integer NOT NULL,
	`client_display_name` text NOT NULL,
	`title` text NOT NULL,
	`conditions` text NOT NULL,
	`currency` text NOT NULL,
	`net_total_cents` integer NOT NULL,
	`vat_total_cents` integer NOT NULL,
	`total_cents` integer NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_user_id` text NOT NULL,
	CONSTRAINT `fk_quote_revisions_quote_id_quotes_id_fk` FOREIGN KEY (`quote_id`) REFERENCES `quotes`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_quote_revisions_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`),
	CONSTRAINT "quote_revisions_id_ulid_check" CHECK("id" is not null and length("id") = 26 and "id" not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr("id", 1, 1) between '0' and '7'),
	CONSTRAINT "quote_revisions_version_check" CHECK("version" >= 1),
	CONSTRAINT "quote_revisions_client_display_name_check" CHECK(length(trim("client_display_name")) > 0),
	CONSTRAINT "quote_revisions_title_check" CHECK(length(trim("title")) between 1 and 120),
	CONSTRAINT "quote_revisions_conditions_check" CHECK(length("conditions") <= 2000),
	CONSTRAINT "quote_revisions_currency_check" CHECK("currency" = 'EUR'),
	CONSTRAINT "quote_revisions_totals_check" CHECK("net_total_cents" between 0 and 9007199254740991 and "vat_total_cents" between 0 and 9007199254740991 and "total_cents" between 0 and 9007199254740991 and "total_cents" = "net_total_cents" + "vat_total_cents")
);
--> statement-breakpoint
CREATE TABLE `quotes` (
	`id` text PRIMARY KEY,
	`client_id` text NOT NULL,
	`status` text NOT NULL,
	`version` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_quotes_client_id_clients_id_fk` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`),
	CONSTRAINT "quotes_id_ulid_check" CHECK("id" is not null and length("id") = 26 and "id" not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr("id", 1, 1) between '0' and '7'),
	CONSTRAINT "quotes_status_check" CHECK("status" in ('draft', 'sent', 'accepted', 'rejected', 'expired')),
	CONSTRAINT "quotes_version_check" CHECK("version" >= 1),
	CONSTRAINT "quotes_timestamps_check" CHECK("updated_at" >= "created_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quote_lines_revision_id_position_unique` ON `quote_lines` (`revision_id`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `quote_revisions_quote_id_version_unique` ON `quote_revisions` (`quote_id`,`version`);--> statement-breakpoint
CREATE INDEX `quote_revisions_created_by_user_id_index` ON `quote_revisions` (`created_by_user_id`);--> statement-breakpoint
CREATE INDEX `quotes_client_id_index` ON `quotes` (`client_id`);
