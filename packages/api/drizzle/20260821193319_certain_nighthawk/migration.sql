DROP TRIGGER IF EXISTS `invoice_revisions_no_update`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `invoice_revisions_no_delete`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `invoice_revisions_business_relation_update`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `invoice_pdf_jobs_business_relation_insert`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `invoice_pdf_jobs_business_relation_update`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `published_quote_revisions_immutable_update`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `published_quote_revisions_immutable_delete`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `quote_revisions_business_relation_update`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `quote_signatures_business_relation_insert`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `orders_business_relation_insert`;--> statement-breakpoint
UPDATE `invoice_revisions`
SET `template_version` = 1,
	`render_snapshot` = json_set(
		`render_snapshot`,
		'$.templateVersion', 1,
		'$.orderReference', (
			SELECT `orders`.`reference`
			FROM `invoices`
			JOIN `orders` ON `orders`.`id` = `invoices`.`order_id`
			WHERE `invoices`.`id` = `invoice_revisions`.`invoice_id`
		),
		'$.quoteReference', (
			SELECT `quotes`.`reference`
			FROM `invoices`
			JOIN `orders` ON `orders`.`id` = `invoices`.`order_id`
			JOIN `quotes` ON `quotes`.`id` = `orders`.`quote_id`
			WHERE `invoices`.`id` = `invoice_revisions`.`invoice_id`
		)
	);--> statement-breakpoint
UPDATE `quote_revisions`
SET `template_version` = 1,
	`render_snapshot` = json_set(
		`render_snapshot`,
		'$.templateVersion', 1,
		'$.quoteReference', (
			SELECT `quotes`.`reference`
			FROM `quotes`
			WHERE `quotes`.`id` = `quote_revisions`.`quote_id`
		)
	)
WHERE `render_snapshot` IS NOT NULL;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_invoice_revisions` (
	`id` text PRIMARY KEY,
	`invoice_id` text NOT NULL,
	`version` integer NOT NULL,
	`invoice_number` text,
	`issued_at` integer,
	`client_display_name` text NOT NULL,
	`title` text NOT NULL,
	`service_date` text NOT NULL,
	`due_date` text NOT NULL,
	`payment_terms` text NOT NULL,
	`currency` text NOT NULL,
	`net_total_cents` integer NOT NULL,
	`vat_total_cents` integer NOT NULL,
	`total_cents` integer NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_user_id` text NOT NULL,
	`template_id` text NOT NULL,
	`template_version` integer NOT NULL,
	`render_snapshot` text NOT NULL,
	CONSTRAINT `fk_invoice_revisions_invoice_id_invoices_id_fk` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`),
	CONSTRAINT `fk_invoice_revisions_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`),
	CONSTRAINT "invoice_revisions_id_ulid_check" CHECK("id" is not null and length("id") = 26 and "id" not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr("id", 1, 1) between '0' and '7'),
	CONSTRAINT "invoice_revisions_version_check" CHECK("version" >= 1),
	CONSTRAINT "invoice_revisions_number_check" CHECK(("invoice_number" is null and "issued_at" is null) or (((length("invoice_number") >= 8 and substr("invoice_number", 1, 2) = 'F-' and substr("invoice_number", 3) not glob '*[^0-9]*') or "invoice_number" glob 'FA-[0-9][0-9][0-9][0-9]-[0-9][0-9][0-9][0-9][0-9][0-9]') and "issued_at" is not null)),
	CONSTRAINT "invoice_revisions_client_display_name_check" CHECK(length(trim("client_display_name")) > 0),
	CONSTRAINT "invoice_revisions_title_check" CHECK(length(trim("title")) between 1 and 120),
	CONSTRAINT "invoice_revisions_dates_check" CHECK(strftime('%Y-%m-%d', "service_date", '+0 days') = "service_date" and strftime('%Y-%m-%d', "due_date", '+0 days') = "due_date" and "due_date" >= "service_date"),
	CONSTRAINT "invoice_revisions_payment_terms_check" CHECK(length("payment_terms") <= 2000),
	CONSTRAINT "invoice_revisions_currency_check" CHECK("currency" = 'EUR'),
	CONSTRAINT "invoice_revisions_totals_check" CHECK("net_total_cents" between 0 and 9007199254740991 and "vat_total_cents" between 0 and 9007199254740991 and "total_cents" between 0 and 9007199254740991 and "total_cents" = "net_total_cents" + "vat_total_cents"),
	CONSTRAINT "invoice_revisions_render_check" CHECK("template_id" = 'invoice-default' and "template_version" = 1 and json_valid("render_snapshot"))
);
--> statement-breakpoint
INSERT INTO `__new_invoice_revisions`(`id`, `invoice_id`, `version`, `invoice_number`, `issued_at`, `client_display_name`, `title`, `service_date`, `due_date`, `payment_terms`, `currency`, `net_total_cents`, `vat_total_cents`, `total_cents`, `created_at`, `created_by_user_id`, `template_id`, `template_version`, `render_snapshot`) SELECT `id`, `invoice_id`, `version`, `invoice_number`, `issued_at`, `client_display_name`, `title`, `service_date`, `due_date`, `payment_terms`, `currency`, `net_total_cents`, `vat_total_cents`, `total_cents`, `created_at`, `created_by_user_id`, `template_id`, `template_version`, `render_snapshot` FROM `invoice_revisions`;--> statement-breakpoint
DROP TABLE `invoice_revisions`;--> statement-breakpoint
ALTER TABLE `__new_invoice_revisions` RENAME TO `invoice_revisions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_quote_revisions` (
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
	CONSTRAINT "quote_revisions_currency_check" CHECK("currency" = 'EUR'),
	CONSTRAINT "quote_revisions_totals_check" CHECK("net_total_cents" between 0 and 9007199254740991 and "vat_total_cents" between 0 and 9007199254740991 and "total_cents" between 0 and 9007199254740991 and "total_cents" = "net_total_cents" + "vat_total_cents"),
	CONSTRAINT "quote_revisions_render_check" CHECK(("render_snapshot" is null and "template_id" is null and "template_version" is null) or ("render_snapshot" is not null and "template_id" = 'quote-default' and "template_version" = 1 and json_valid("render_snapshot")))
);
--> statement-breakpoint
INSERT INTO `__new_quote_revisions`(`id`, `quote_id`, `version`, `client_display_name`, `title`, `conditions`, `currency`, `net_total_cents`, `vat_total_cents`, `total_cents`, `created_at`, `created_by_user_id`, `template_id`, `template_version`, `render_snapshot`) SELECT `id`, `quote_id`, `version`, `client_display_name`, `title`, `conditions`, `currency`, `net_total_cents`, `vat_total_cents`, `total_cents`, `created_at`, `created_by_user_id`, `template_id`, `template_version`, `render_snapshot` FROM `quote_revisions`;--> statement-breakpoint
DROP TABLE `quote_revisions`;--> statement-breakpoint
ALTER TABLE `__new_quote_revisions` RENAME TO `quote_revisions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `invoice_revisions_invoice_id_version_unique` ON `invoice_revisions` (`invoice_id`,`version`);--> statement-breakpoint
CREATE INDEX `invoice_revisions_created_by_user_id_index` ON `invoice_revisions` (`created_by_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `quote_revisions_quote_id_version_unique` ON `quote_revisions` (`quote_id`,`version`);--> statement-breakpoint
CREATE INDEX `quote_revisions_created_by_user_id_index` ON `quote_revisions` (`created_by_user_id`);--> statement-breakpoint
CREATE TRIGGER `invoice_revisions_no_update` BEFORE UPDATE ON `invoice_revisions` BEGIN SELECT RAISE(ABORT, 'invoice revisions are append-only'); END;--> statement-breakpoint
CREATE TRIGGER `invoice_revisions_no_delete` BEFORE DELETE ON `invoice_revisions` BEGIN SELECT RAISE(ABORT, 'invoice revisions are append-only'); END;--> statement-breakpoint
CREATE TRIGGER `invoice_revisions_business_relation_update` BEFORE UPDATE OF `invoice_id`, `version`, `invoice_number` ON `invoice_revisions` WHEN EXISTS (SELECT 1 FROM `invoice_pdf_jobs` WHERE `invoice_revision_id` = OLD.`id` AND (`invoice_id` <> NEW.`invoice_id` OR `version` <> NEW.`version` OR `invoice_number` <> NEW.`invoice_number`)) BEGIN SELECT RAISE(ABORT, 'invoice revision business relationship violation'); END;--> statement-breakpoint
CREATE TRIGGER `invoice_pdf_jobs_business_relation_insert` BEFORE INSERT ON `invoice_pdf_jobs` WHEN NOT EXISTS (SELECT 1 FROM `invoice_revisions` WHERE `id` = NEW.`invoice_revision_id` AND `invoice_id` = NEW.`invoice_id` AND `version` = NEW.`version` AND `invoice_number` = NEW.`invoice_number`) BEGIN SELECT RAISE(ABORT, 'invoice PDF job business relationship violation'); END;--> statement-breakpoint
CREATE TRIGGER `invoice_pdf_jobs_business_relation_update` BEFORE UPDATE OF `invoice_revision_id`, `invoice_id`, `invoice_number`, `version` ON `invoice_pdf_jobs` WHEN NOT EXISTS (SELECT 1 FROM `invoice_revisions` WHERE `id` = NEW.`invoice_revision_id` AND `invoice_id` = NEW.`invoice_id` AND `version` = NEW.`version` AND `invoice_number` = NEW.`invoice_number`) BEGIN SELECT RAISE(ABORT, 'invoice PDF job business relationship violation'); END;--> statement-breakpoint
CREATE TRIGGER `published_quote_revisions_immutable_update` BEFORE UPDATE ON `quote_revisions` WHEN EXISTS (SELECT 1 FROM `document_artifacts` WHERE `revision_id` = OLD.`id`) BEGIN SELECT RAISE(ABORT, 'published quote revisions are immutable'); END;--> statement-breakpoint
CREATE TRIGGER `published_quote_revisions_immutable_delete` BEFORE DELETE ON `quote_revisions` WHEN EXISTS (SELECT 1 FROM `document_artifacts` WHERE `revision_id` = OLD.`id`) BEGIN SELECT RAISE(ABORT, 'published quote revisions are immutable'); END;--> statement-breakpoint
CREATE TRIGGER `quote_revisions_business_relation_update` BEFORE UPDATE OF `quote_id` ON `quote_revisions` WHEN EXISTS (SELECT 1 FROM `quote_signatures` WHERE `revision_id` = OLD.`id` AND `quote_id` <> NEW.`quote_id`) OR EXISTS (SELECT 1 FROM `orders` WHERE `revision_id` = OLD.`id` AND `quote_id` <> NEW.`quote_id`) BEGIN SELECT RAISE(ABORT, 'quote revision business relationship violation'); END;--> statement-breakpoint
CREATE TRIGGER `quote_signatures_business_relation_insert` BEFORE INSERT ON `quote_signatures` WHEN NOT EXISTS (SELECT 1 FROM `quote_revisions` WHERE `id` = NEW.`revision_id` AND `quote_id` = NEW.`quote_id`) OR NOT EXISTS (SELECT 1 FROM `quote_links` WHERE `id` = NEW.`link_id` AND `revision_id` = NEW.`revision_id`) BEGIN SELECT RAISE(ABORT, 'quote signature business relationship violation'); END;--> statement-breakpoint
CREATE TRIGGER `orders_business_relation_insert` BEFORE INSERT ON `orders` WHEN NOT EXISTS (SELECT 1 FROM `quotes` WHERE `id` = NEW.`quote_id` AND `client_id` = NEW.`client_id`) OR NOT EXISTS (SELECT 1 FROM `quote_revisions` WHERE `id` = NEW.`revision_id` AND `quote_id` = NEW.`quote_id`) OR NOT EXISTS (SELECT 1 FROM `quote_signatures` WHERE `id` = NEW.`signature_id` AND `quote_id` = NEW.`quote_id` AND `revision_id` = NEW.`revision_id`) BEGIN SELECT RAISE(ABORT, 'order business relationship violation'); END;
