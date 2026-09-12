ALTER TABLE `invoice_revisions` ADD `functional_currency` text;--> statement-breakpoint
ALTER TABLE `invoice_revisions` ADD `exchange_rate_date` text;--> statement-breakpoint
ALTER TABLE `invoice_revisions` ADD `foreign_units_per_functional_unit_nanos` integer;--> statement-breakpoint
ALTER TABLE `invoice_revisions` ADD `functional_net_total_cents` integer;--> statement-breakpoint
ALTER TABLE `invoice_revisions` ADD `functional_vat_total_cents` integer;--> statement-breakpoint
ALTER TABLE `invoice_revisions` ADD `functional_total_cents` integer;--> statement-breakpoint
DROP TRIGGER IF EXISTS `invoice_pdf_jobs_business_relation_insert`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `invoice_pdf_jobs_business_relation_update`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `invoice_revisions_business_relation_update`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `invoice_revisions_no_delete`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `invoice_revisions_no_update`;--> statement-breakpoint
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
	`payment_terms_presentation` text,
	`currency` text NOT NULL,
	`net_total_cents` integer NOT NULL,
	`vat_total_cents` integer NOT NULL,
	`total_cents` integer NOT NULL,
	`functional_currency` text,
	`exchange_rate_date` text,
	`foreign_units_per_functional_unit_nanos` integer,
	`functional_net_total_cents` integer,
	`functional_vat_total_cents` integer,
	`functional_total_cents` integer,
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
	CONSTRAINT "invoice_revisions_payment_terms_presentation_check" CHECK("payment_terms_presentation" is null or json_valid("payment_terms_presentation")),
	CONSTRAINT "invoice_revisions_currency_check" CHECK("currency" glob '[A-Z][A-Z][A-Z]'),
	CONSTRAINT "invoice_revisions_totals_check" CHECK("net_total_cents" between 0 and 9007199254740991 and "vat_total_cents" between 0 and 9007199254740991 and "total_cents" between 0 and 9007199254740991 and "total_cents" = "net_total_cents" + "vat_total_cents"),
	CONSTRAINT "invoice_revisions_functional_values_check" CHECK(("functional_currency" is null and "exchange_rate_date" is null and "foreign_units_per_functional_unit_nanos" is null and "functional_net_total_cents" is null and "functional_vat_total_cents" is null and "functional_total_cents" is null) or ("functional_currency" glob '[A-Z][A-Z][A-Z]' and strftime('%Y-%m-%d', "exchange_rate_date", '+0 days') = "exchange_rate_date" and "foreign_units_per_functional_unit_nanos" between 1 and 9007199254740991 and "functional_net_total_cents" between 0 and 9007199254740991 and "functional_vat_total_cents" between 0 and 9007199254740991 and "functional_total_cents" = "functional_net_total_cents" + "functional_vat_total_cents")),
	CONSTRAINT "invoice_revisions_render_check" CHECK("template_id" = 'invoice-default' and "template_version" = 1 and json_valid("render_snapshot"))
);
--> statement-breakpoint
INSERT INTO `__new_invoice_revisions`(`id`, `invoice_id`, `version`, `invoice_number`, `issued_at`, `client_display_name`, `title`, `service_date`, `due_date`, `payment_terms`, `payment_terms_presentation`, `currency`, `net_total_cents`, `vat_total_cents`, `total_cents`, `created_at`, `created_by_user_id`, `template_id`, `template_version`, `render_snapshot`) SELECT `id`, `invoice_id`, `version`, `invoice_number`, `issued_at`, `client_display_name`, `title`, `service_date`, `due_date`, `payment_terms`, `payment_terms_presentation`, `currency`, `net_total_cents`, `vat_total_cents`, `total_cents`, `created_at`, `created_by_user_id`, `template_id`, `template_version`, `render_snapshot` FROM `invoice_revisions`;--> statement-breakpoint
DROP TABLE `invoice_revisions`;--> statement-breakpoint
ALTER TABLE `__new_invoice_revisions` RENAME TO `invoice_revisions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `invoice_revisions_invoice_id_version_unique` ON `invoice_revisions` (`invoice_id`,`version`);--> statement-breakpoint
CREATE INDEX `invoice_revisions_created_by_user_id_index` ON `invoice_revisions` (`created_by_user_id`);--> statement-breakpoint
CREATE TRIGGER `invoice_revisions_business_relation_update` BEFORE UPDATE OF `invoice_id`, `version`, `invoice_number` ON `invoice_revisions` WHEN EXISTS (SELECT 1 FROM `invoice_pdf_jobs` WHERE `invoice_revision_id` = OLD.`id` AND (`invoice_id` <> NEW.`invoice_id` OR `version` <> NEW.`version` OR `invoice_number` <> NEW.`invoice_number`)) BEGIN SELECT RAISE(ABORT, 'database.trigger.invoice_revisions_business_relation_update'); END;--> statement-breakpoint
CREATE TRIGGER `invoice_revisions_no_delete` BEFORE DELETE ON `invoice_revisions` BEGIN SELECT RAISE(ABORT, 'database.trigger.invoice_revisions_no_delete'); END;--> statement-breakpoint
CREATE TRIGGER `invoice_revisions_no_update` BEFORE UPDATE ON `invoice_revisions` BEGIN SELECT RAISE(ABORT, 'database.trigger.invoice_revisions_no_update'); END;--> statement-breakpoint
CREATE TRIGGER `invoice_pdf_jobs_business_relation_insert` BEFORE INSERT ON `invoice_pdf_jobs` WHEN NOT EXISTS (SELECT 1 FROM `invoice_revisions` WHERE `id` = NEW.`invoice_revision_id` AND `invoice_id` = NEW.`invoice_id` AND `version` = NEW.`version` AND `invoice_number` = NEW.`invoice_number`) BEGIN SELECT RAISE(ABORT, 'database.trigger.invoice_pdf_jobs_business_relation_insert'); END;--> statement-breakpoint
CREATE TRIGGER `invoice_pdf_jobs_business_relation_update` BEFORE UPDATE OF `invoice_revision_id`, `invoice_id`, `invoice_number`, `version` ON `invoice_pdf_jobs` WHEN NOT EXISTS (SELECT 1 FROM `invoice_revisions` WHERE `id` = NEW.`invoice_revision_id` AND `invoice_id` = NEW.`invoice_id` AND `version` = NEW.`version` AND `invoice_number` = NEW.`invoice_number`) BEGIN SELECT RAISE(ABORT, 'database.trigger.invoice_pdf_jobs_business_relation_update'); END;
