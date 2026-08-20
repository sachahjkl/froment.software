CREATE TEMP TABLE `_migration_invoice_data_check` (
	`valid` integer NOT NULL,
	CONSTRAINT `existing_invoice_data_violates_new_constraints` CHECK (`valid` = 1)
);--> statement-breakpoint
INSERT INTO `_migration_invoice_data_check` (`valid`)
SELECT 0 FROM `invoices`
WHERE (`invoice_number` IS NOT NULL AND (length(`invoice_number`) < 8 OR substr(`invoice_number`, 1, 2) <> 'F-' OR substr(`invoice_number`, 3) GLOB '*[^0-9]*'))
UNION ALL
SELECT 0 FROM `invoice_revisions`
WHERE strftime('%Y-%m-%d', `service_date`, '+0 days') <> `service_date`
   OR strftime('%Y-%m-%d', `due_date`, '+0 days') <> `due_date`
   OR (`invoice_number` IS NOT NULL AND (length(`invoice_number`) < 8 OR substr(`invoice_number`, 1, 2) <> 'F-' OR substr(`invoice_number`, 3) GLOB '*[^0-9]*'))
UNION ALL
SELECT 0 FROM `invoice_pdf_jobs`
WHERE length(`invoice_number`) < 8 OR substr(`invoice_number`, 1, 2) <> 'F-' OR substr(`invoice_number`, 3) GLOB '*[^0-9]*';--> statement-breakpoint
DROP TABLE `_migration_invoice_data_check`;--> statement-breakpoint
CREATE TEMP TABLE `_migration_business_relation_check` (
	`valid` integer NOT NULL,
	CONSTRAINT `existing_data_violates_business_relationships` CHECK (`valid` = 1)
);--> statement-breakpoint
INSERT INTO `_migration_business_relation_check` (`valid`)
SELECT 0 FROM `quote_signatures` AS `signature`
WHERE NOT EXISTS (SELECT 1 FROM `quote_revisions` AS `revision` WHERE `revision`.`id` = `signature`.`revision_id` AND `revision`.`quote_id` = `signature`.`quote_id`)
   OR NOT EXISTS (SELECT 1 FROM `quote_links` AS `link` WHERE `link`.`id` = `signature`.`link_id` AND `link`.`revision_id` = `signature`.`revision_id`)
UNION ALL
SELECT 0 FROM `orders` AS `orders_check`
WHERE NOT EXISTS (SELECT 1 FROM `quotes` AS `quote` WHERE `quote`.`id` = `orders_check`.`quote_id` AND `quote`.`client_id` = `orders_check`.`client_id`)
   OR NOT EXISTS (SELECT 1 FROM `quote_revisions` AS `revision` WHERE `revision`.`id` = `orders_check`.`revision_id` AND `revision`.`quote_id` = `orders_check`.`quote_id`)
   OR NOT EXISTS (SELECT 1 FROM `quote_signatures` AS `signature` WHERE `signature`.`id` = `orders_check`.`signature_id` AND `signature`.`quote_id` = `orders_check`.`quote_id` AND `signature`.`revision_id` = `orders_check`.`revision_id`)
UNION ALL
SELECT 0 FROM `invoices` AS `invoice`
WHERE NOT EXISTS (SELECT 1 FROM `orders` AS `invoice_order` WHERE `invoice_order`.`id` = `invoice`.`order_id` AND `invoice_order`.`client_id` = `invoice`.`client_id`)
UNION ALL
SELECT 0 FROM `invoice_pdf_jobs` AS `job`
WHERE NOT EXISTS (SELECT 1 FROM `invoice_revisions` AS `revision` WHERE `revision`.`id` = `job`.`invoice_revision_id` AND `revision`.`invoice_id` = `job`.`invoice_id` AND `revision`.`version` = `job`.`version` AND `revision`.`invoice_number` = `job`.`invoice_number`);--> statement-breakpoint
DROP TABLE `_migration_business_relation_check`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_invoice_pdf_jobs` (
	`invoice_revision_id` text PRIMARY KEY,
	`invoice_id` text NOT NULL,
	`invoice_number` text NOT NULL,
	`version` integer NOT NULL,
	`actor_user_id` text NOT NULL,
	`status` text NOT NULL,
	`attempts` integer NOT NULL,
	`error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_invoice_pdf_jobs_invoice_revision_id_invoice_revisions_id_fk` FOREIGN KEY (`invoice_revision_id`) REFERENCES `invoice_revisions`(`id`),
	CONSTRAINT `fk_invoice_pdf_jobs_invoice_id_invoices_id_fk` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`),
	CONSTRAINT `fk_invoice_pdf_jobs_actor_user_id_users_id_fk` FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`),
	CONSTRAINT "invoice_pdf_jobs_revision_id_ulid_check" CHECK("invoice_revision_id" is not null and length("invoice_revision_id") = 26 and "invoice_revision_id" not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr("invoice_revision_id", 1, 1) between '0' and '7'),
	CONSTRAINT "invoice_pdf_jobs_invoice_id_ulid_check" CHECK("invoice_id" is not null and length("invoice_id") = 26 and "invoice_id" not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr("invoice_id", 1, 1) between '0' and '7'),
	CONSTRAINT "invoice_pdf_jobs_actor_id_ulid_check" CHECK("actor_user_id" is not null and length("actor_user_id") = 26 and "actor_user_id" not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr("actor_user_id", 1, 1) between '0' and '7'),
	CONSTRAINT "invoice_pdf_jobs_number_check" CHECK(length("invoice_number") >= 8 and substr("invoice_number", 1, 2) = 'F-' and substr("invoice_number", 3) not glob '*[^0-9]*'),
	CONSTRAINT "invoice_pdf_jobs_version_check" CHECK("version" >= 1),
	CONSTRAINT "invoice_pdf_jobs_status_check" CHECK("status" in ('pending', 'processing', 'ready', 'failed')),
	CONSTRAINT "invoice_pdf_jobs_attempts_check" CHECK("attempts" >= 0),
	CONSTRAINT "invoice_pdf_jobs_error_check" CHECK(("status" = 'failed' and "error" = 'pdf.render_failed') or ("status" <> 'failed' and "error" is null)),
	CONSTRAINT "invoice_pdf_jobs_timestamps_check" CHECK("updated_at" >= "created_at")
);
--> statement-breakpoint
INSERT INTO `__new_invoice_pdf_jobs`(`invoice_revision_id`, `invoice_id`, `invoice_number`, `version`, `actor_user_id`, `status`, `attempts`, `error`, `created_at`, `updated_at`) SELECT `invoice_revision_id`, `invoice_id`, `invoice_number`, `version`, `actor_user_id`, `status`, `attempts`, `error`, `created_at`, `updated_at` FROM `invoice_pdf_jobs`;--> statement-breakpoint
DROP TABLE `invoice_pdf_jobs`;--> statement-breakpoint
ALTER TABLE `__new_invoice_pdf_jobs` RENAME TO `invoice_pdf_jobs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
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
	CONSTRAINT "invoice_revisions_number_check" CHECK(("invoice_number" is null and "issued_at" is null) or (length("invoice_number") >= 8 and substr("invoice_number", 1, 2) = 'F-' and substr("invoice_number", 3) not glob '*[^0-9]*' and "issued_at" is not null)),
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
CREATE TABLE `__new_invoices` (
	`id` text PRIMARY KEY,
	`order_id` text NOT NULL,
	`client_id` text NOT NULL,
	`status` text NOT NULL,
	`version` integer NOT NULL,
	`invoice_number` text,
	`issued_at` integer,
	`paid_at` integer,
	`voided_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_invoices_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`),
	CONSTRAINT `fk_invoices_client_id_clients_id_fk` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`),
	CONSTRAINT "invoices_id_ulid_check" CHECK("id" is not null and length("id") = 26 and "id" not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr("id", 1, 1) between '0' and '7'),
	CONSTRAINT "invoices_status_check" CHECK("status" in ('draft', 'issued', 'paid', 'void')),
	CONSTRAINT "invoices_version_check" CHECK("version" >= 1),
	CONSTRAINT "invoices_number_state_check" CHECK(("status" = 'draft' and "invoice_number" is null and "issued_at" is null) or ("status" in ('issued', 'paid', 'void') and length("invoice_number") >= 8 and substr("invoice_number", 1, 2) = 'F-' and substr("invoice_number", 3) not glob '*[^0-9]*' and "issued_at" is not null)),
	CONSTRAINT "invoices_terminal_state_check" CHECK(("status" = 'paid' and "paid_at" is not null and "voided_at" is null) or ("status" = 'void' and "voided_at" is not null and "paid_at" is null) or ("status" in ('draft', 'issued') and "paid_at" is null and "voided_at" is null)),
	CONSTRAINT "invoices_timestamps_check" CHECK("updated_at" >= "created_at")
);
--> statement-breakpoint
INSERT INTO `__new_invoices`(`id`, `order_id`, `client_id`, `status`, `version`, `invoice_number`, `issued_at`, `paid_at`, `voided_at`, `created_at`, `updated_at`) SELECT `id`, `order_id`, `client_id`, `status`, `version`, `invoice_number`, `issued_at`, `paid_at`, `voided_at`, `created_at`, `updated_at` FROM `invoices`;--> statement-breakpoint
DROP TABLE `invoices`;--> statement-breakpoint
ALTER TABLE `__new_invoices` RENAME TO `invoices`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `invoice_pdf_jobs_invoice_id_unique` ON `invoice_pdf_jobs` (`invoice_id`);--> statement-breakpoint
CREATE INDEX `invoice_pdf_jobs_status_updated_at_index` ON `invoice_pdf_jobs` (`status`,`updated_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `invoice_revisions_invoice_id_version_unique` ON `invoice_revisions` (`invoice_id`,`version`);--> statement-breakpoint
CREATE INDEX `invoice_revisions_created_by_user_id_index` ON `invoice_revisions` (`created_by_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_order_id_unique` ON `invoices` (`order_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_invoice_number_unique` ON `invoices` (`invoice_number`);--> statement-breakpoint
CREATE INDEX `invoices_client_id_index` ON `invoices` (`client_id`);
--> statement-breakpoint
CREATE TRIGGER `document_artifacts_immutable_update`
BEFORE UPDATE ON `document_artifacts`
BEGIN
	SELECT RAISE(ABORT, 'document artifacts are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `document_artifacts_immutable_delete`
BEFORE DELETE ON `document_artifacts`
BEGIN
	SELECT RAISE(ABORT, 'document artifacts are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `published_quote_revisions_immutable_update`
BEFORE UPDATE ON `quote_revisions`
WHEN EXISTS (SELECT 1 FROM `document_artifacts` WHERE `revision_id` = OLD.`id`)
BEGIN
	SELECT RAISE(ABORT, 'published quote revisions are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `published_quote_revisions_immutable_delete`
BEFORE DELETE ON `quote_revisions`
WHEN EXISTS (SELECT 1 FROM `document_artifacts` WHERE `revision_id` = OLD.`id`)
BEGIN
	SELECT RAISE(ABORT, 'published quote revisions are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `published_quote_lines_immutable_insert`
BEFORE INSERT ON `quote_lines`
WHEN EXISTS (SELECT 1 FROM `document_artifacts` WHERE `revision_id` = NEW.`revision_id`)
BEGIN
	SELECT RAISE(ABORT, 'published quote lines are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `published_quote_lines_immutable_update`
BEFORE UPDATE ON `quote_lines`
WHEN EXISTS (SELECT 1 FROM `document_artifacts` WHERE `revision_id` IN (OLD.`revision_id`, NEW.`revision_id`))
BEGIN
	SELECT RAISE(ABORT, 'published quote lines are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `published_quote_lines_immutable_delete`
BEFORE DELETE ON `quote_lines`
WHEN EXISTS (SELECT 1 FROM `document_artifacts` WHERE `revision_id` = OLD.`revision_id`)
BEGIN
	SELECT RAISE(ABORT, 'published quote lines are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `invoice_revisions_no_update`
BEFORE UPDATE ON `invoice_revisions`
BEGIN
	SELECT RAISE(ABORT, 'invoice revisions are append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `invoice_revisions_no_delete`
BEFORE DELETE ON `invoice_revisions`
BEGIN
	SELECT RAISE(ABORT, 'invoice revisions are append-only');
END;
--> statement-breakpoint
CREATE TRIGGER `published_invoice_lines_immutable_insert`
BEFORE INSERT ON `invoice_lines`
WHEN EXISTS (SELECT 1 FROM `document_artifacts` WHERE `invoice_revision_id` = NEW.`revision_id`)
BEGIN
	SELECT RAISE(ABORT, 'published invoice lines are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `quote_signatures_business_relation_insert`
BEFORE INSERT ON `quote_signatures`
WHEN NOT EXISTS (SELECT 1 FROM `quote_revisions` WHERE `id` = NEW.`revision_id` AND `quote_id` = NEW.`quote_id`)
  OR NOT EXISTS (SELECT 1 FROM `quote_links` WHERE `id` = NEW.`link_id` AND `revision_id` = NEW.`revision_id`)
BEGIN
	SELECT RAISE(ABORT, 'quote signature business relationship violation');
END;
--> statement-breakpoint
CREATE TRIGGER `quotes_business_relation_update`
BEFORE UPDATE OF `client_id` ON `quotes`
WHEN EXISTS (SELECT 1 FROM `orders` WHERE `quote_id` = OLD.`id` AND `client_id` <> NEW.`client_id`)
BEGIN
	SELECT RAISE(ABORT, 'quote business relationship violation');
END;
--> statement-breakpoint
CREATE TRIGGER `quote_revisions_business_relation_update`
BEFORE UPDATE OF `quote_id` ON `quote_revisions`
WHEN EXISTS (SELECT 1 FROM `quote_signatures` WHERE `revision_id` = OLD.`id` AND `quote_id` <> NEW.`quote_id`)
  OR EXISTS (SELECT 1 FROM `orders` WHERE `revision_id` = OLD.`id` AND `quote_id` <> NEW.`quote_id`)
BEGIN
	SELECT RAISE(ABORT, 'quote revision business relationship violation');
END;
--> statement-breakpoint
CREATE TRIGGER `quote_links_business_relation_update`
BEFORE UPDATE OF `revision_id` ON `quote_links`
WHEN EXISTS (SELECT 1 FROM `quote_signatures` WHERE `link_id` = OLD.`id` AND `revision_id` <> NEW.`revision_id`)
BEGIN
	SELECT RAISE(ABORT, 'quote link business relationship violation');
END;
--> statement-breakpoint
CREATE TRIGGER `quote_signatures_immutable_update`
BEFORE UPDATE ON `quote_signatures`
BEGIN
	SELECT RAISE(ABORT, 'quote signatures are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `quote_signatures_immutable_delete`
BEFORE DELETE ON `quote_signatures`
BEGIN
	SELECT RAISE(ABORT, 'quote signatures are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `orders_business_relation_insert`
BEFORE INSERT ON `orders`
WHEN NOT EXISTS (SELECT 1 FROM `quotes` WHERE `id` = NEW.`quote_id` AND `client_id` = NEW.`client_id`)
  OR NOT EXISTS (SELECT 1 FROM `quote_revisions` WHERE `id` = NEW.`revision_id` AND `quote_id` = NEW.`quote_id`)
  OR NOT EXISTS (SELECT 1 FROM `quote_signatures` WHERE `id` = NEW.`signature_id` AND `quote_id` = NEW.`quote_id` AND `revision_id` = NEW.`revision_id`)
BEGIN
	SELECT RAISE(ABORT, 'order business relationship violation');
END;
--> statement-breakpoint
CREATE TRIGGER `orders_immutable_update`
BEFORE UPDATE ON `orders`
BEGIN
	SELECT RAISE(ABORT, 'orders are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `orders_immutable_delete`
BEFORE DELETE ON `orders`
BEGIN
	SELECT RAISE(ABORT, 'orders are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER `invoices_business_relation_insert`
BEFORE INSERT ON `invoices`
WHEN NOT EXISTS (SELECT 1 FROM `orders` WHERE `id` = NEW.`order_id` AND `client_id` = NEW.`client_id`)
BEGIN
	SELECT RAISE(ABORT, 'invoice business relationship violation');
END;
--> statement-breakpoint
CREATE TRIGGER `invoices_business_relation_update`
BEFORE UPDATE OF `order_id`, `client_id` ON `invoices`
WHEN NOT EXISTS (SELECT 1 FROM `orders` WHERE `id` = NEW.`order_id` AND `client_id` = NEW.`client_id`)
BEGIN
	SELECT RAISE(ABORT, 'invoice business relationship violation');
END;
--> statement-breakpoint
CREATE TRIGGER `invoice_pdf_jobs_business_relation_insert`
BEFORE INSERT ON `invoice_pdf_jobs`
WHEN NOT EXISTS (SELECT 1 FROM `invoice_revisions` WHERE `id` = NEW.`invoice_revision_id` AND `invoice_id` = NEW.`invoice_id` AND `version` = NEW.`version` AND `invoice_number` = NEW.`invoice_number`)
BEGIN
	SELECT RAISE(ABORT, 'invoice PDF job business relationship violation');
END;
--> statement-breakpoint
CREATE TRIGGER `invoice_revisions_business_relation_update`
BEFORE UPDATE OF `invoice_id`, `version`, `invoice_number` ON `invoice_revisions`
WHEN EXISTS (
	SELECT 1 FROM `invoice_pdf_jobs`
	WHERE `invoice_revision_id` = OLD.`id`
	  AND (`invoice_id` <> NEW.`invoice_id` OR `version` <> NEW.`version` OR `invoice_number` <> NEW.`invoice_number`)
)
BEGIN
	SELECT RAISE(ABORT, 'invoice revision business relationship violation');
END;
--> statement-breakpoint
CREATE TRIGGER `invoice_pdf_jobs_business_relation_update`
BEFORE UPDATE OF `invoice_revision_id`, `invoice_id`, `invoice_number`, `version` ON `invoice_pdf_jobs`
WHEN NOT EXISTS (SELECT 1 FROM `invoice_revisions` WHERE `id` = NEW.`invoice_revision_id` AND `invoice_id` = NEW.`invoice_id` AND `version` = NEW.`version` AND `invoice_number` = NEW.`invoice_number`)
BEGIN
	SELECT RAISE(ABORT, 'invoice PDF job business relationship violation');
END;
