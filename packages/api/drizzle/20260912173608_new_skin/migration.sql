PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_catalog_items` (
	`id` text PRIMARY KEY,
	`description` text NOT NULL,
	`quantity_milli` integer NOT NULL,
	`unit_price_cents` integer NOT NULL,
	`vat_rate_basis_points` integer NOT NULL,
	`currency` text NOT NULL,
	`version` integer NOT NULL,
	`archived` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "catalog_description_check" CHECK(length(trim("description")) between 1 and 160),
	CONSTRAINT "catalog_quantity_check" CHECK("quantity_milli" between 1 and 9007199254740991),
	CONSTRAINT "catalog_price_check" CHECK("unit_price_cents" between 0 and 9007199254740991),
	CONSTRAINT "catalog_tax_check" CHECK("vat_rate_basis_points" between 0 and 10000),
	CONSTRAINT "catalog_currency_check" CHECK("currency" glob '[A-Z][A-Z][A-Z]'),
	CONSTRAINT "catalog_version_check" CHECK("version" between 1 and 9007199254740991),
	CONSTRAINT "catalog_archived_check" CHECK("archived" in (0, 1)),
	CONSTRAINT "catalog_timestamps_check" CHECK("updated_at" >= "created_at")
);
--> statement-breakpoint
INSERT INTO `__new_catalog_items`(`id`, `description`, `quantity_milli`, `unit_price_cents`, `vat_rate_basis_points`, `currency`, `version`, `archived`, `created_at`, `updated_at`) SELECT `id`, `description`, `quantity_milli`, `unit_price_cents`, `vat_rate_basis_points`, `currency`, `version`, `archived`, `created_at`, `updated_at` FROM `catalog_items`;--> statement-breakpoint
DROP TABLE `catalog_items`;--> statement-breakpoint
ALTER TABLE `__new_catalog_items` RENAME TO `catalog_items`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
DROP TRIGGER IF EXISTS `orders_business_relation_insert`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `published_quote_revisions_immutable_delete`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `published_quote_revisions_immutable_update`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `quote_revisions_business_relation_update`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `quote_signatures_business_relation_insert`;--> statement-breakpoint
CREATE TABLE `__new_quote_revisions` (
	`id` text PRIMARY KEY,
	`quote_id` text NOT NULL,
	`version` integer NOT NULL,
	`client_display_name` text NOT NULL,
	`title` text NOT NULL,
	`conditions` text NOT NULL,
	`conditions_presentation` text,
	`currency` text NOT NULL,
	`net_total_cents` integer NOT NULL,
	`vat_total_cents` integer NOT NULL,
	`total_cents` integer NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_user_id` text NOT NULL,
	`template_id` text,
	`template_version` integer,
	`render_snapshot` text,
	CONSTRAINT `fk_quote_revisions_quote_id_quotes_id_fk` FOREIGN KEY (`quote_id`) REFERENCES `quotes`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_quote_revisions_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`),
	CONSTRAINT "quote_revisions_id_ulid_check" CHECK("id" is not null and length("id") = 26 and "id" not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr("id", 1, 1) between '0' and '7'),
	CONSTRAINT "quote_revisions_version_check" CHECK("version" >= 1),
	CONSTRAINT "quote_revisions_client_display_name_check" CHECK(length(trim("client_display_name")) > 0),
	CONSTRAINT "quote_revisions_title_check" CHECK(length(trim("title")) between 1 and 120),
	CONSTRAINT "quote_revisions_conditions_check" CHECK(length("conditions") <= 2000),
	CONSTRAINT "quote_revisions_conditions_presentation_check" CHECK("conditions_presentation" is null or json_valid("conditions_presentation")),
	CONSTRAINT "quote_revisions_currency_check" CHECK("currency" glob '[A-Z][A-Z][A-Z]'),
	CONSTRAINT "quote_revisions_totals_check" CHECK("net_total_cents" between 0 and 9007199254740991 and "vat_total_cents" between 0 and 9007199254740991 and "total_cents" between 0 and 9007199254740991 and "total_cents" = "net_total_cents" + "vat_total_cents"),
	CONSTRAINT "quote_revisions_render_check" CHECK(("render_snapshot" is null and "template_id" is null and "template_version" is null) or ("render_snapshot" is not null and "template_id" = 'quote-default' and "template_version" = 1 and json_valid("render_snapshot")))
);
--> statement-breakpoint
INSERT INTO `__new_quote_revisions`(`id`, `quote_id`, `version`, `client_display_name`, `title`, `conditions`, `conditions_presentation`, `currency`, `net_total_cents`, `vat_total_cents`, `total_cents`, `created_at`, `created_by_user_id`, `template_id`, `template_version`, `render_snapshot`) SELECT `id`, `quote_id`, `version`, `client_display_name`, `title`, `conditions`, `conditions_presentation`, `currency`, `net_total_cents`, `vat_total_cents`, `total_cents`, `created_at`, `created_by_user_id`, `template_id`, `template_version`, `render_snapshot` FROM `quote_revisions`;--> statement-breakpoint
DROP TABLE `quote_revisions`;--> statement-breakpoint
ALTER TABLE `__new_quote_revisions` RENAME TO `quote_revisions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `quote_revisions_quote_id_version_unique` ON `quote_revisions` (`quote_id`,`version`);--> statement-breakpoint
CREATE INDEX `quote_revisions_created_by_user_id_index` ON `quote_revisions` (`created_by_user_id`);--> statement-breakpoint
CREATE TRIGGER `orders_business_relation_insert` BEFORE INSERT ON `orders` WHEN NOT EXISTS (SELECT 1 FROM `quotes` WHERE `id` = NEW.`quote_id` AND `client_id` = NEW.`client_id`) OR NOT EXISTS (SELECT 1 FROM `quote_revisions` WHERE `id` = NEW.`revision_id` AND `quote_id` = NEW.`quote_id`) OR NOT EXISTS (SELECT 1 FROM `quote_signatures` WHERE `id` = NEW.`signature_id` AND `quote_id` = NEW.`quote_id` AND `revision_id` = NEW.`revision_id`) BEGIN SELECT RAISE(ABORT, 'database.trigger.orders_business_relation_insert'); END;--> statement-breakpoint
CREATE TRIGGER `published_quote_revisions_immutable_delete` BEFORE DELETE ON `quote_revisions` WHEN EXISTS (SELECT 1 FROM `document_artifacts` WHERE `revision_id` = OLD.`id`) BEGIN SELECT RAISE(ABORT, 'database.trigger.published_quote_revisions_immutable_delete'); END;--> statement-breakpoint
CREATE TRIGGER `published_quote_revisions_immutable_update` BEFORE UPDATE ON `quote_revisions` WHEN EXISTS (SELECT 1 FROM `document_artifacts` WHERE `revision_id` = OLD.`id`) BEGIN SELECT RAISE(ABORT, 'database.trigger.published_quote_revisions_immutable_update'); END;--> statement-breakpoint
CREATE TRIGGER `quote_revisions_business_relation_update` BEFORE UPDATE OF `quote_id` ON `quote_revisions` WHEN EXISTS (SELECT 1 FROM `quote_signatures` WHERE `revision_id` = OLD.`id` AND `quote_id` <> NEW.`quote_id`) OR EXISTS (SELECT 1 FROM `orders` WHERE `revision_id` = OLD.`id` AND `quote_id` <> NEW.`quote_id`) BEGIN SELECT RAISE(ABORT, 'database.trigger.quote_revisions_business_relation_update'); END;--> statement-breakpoint
CREATE TRIGGER `quote_signatures_business_relation_insert` BEFORE INSERT ON `quote_signatures` WHEN NOT EXISTS (SELECT 1 FROM `quote_revisions` WHERE `id` = NEW.`revision_id` AND `quote_id` = NEW.`quote_id`) OR NOT EXISTS (SELECT 1 FROM `quote_links` WHERE `id` = NEW.`link_id` AND `revision_id` = NEW.`revision_id`) BEGIN SELECT RAISE(ABORT, 'database.trigger.quote_signatures_business_relation_insert'); END;
