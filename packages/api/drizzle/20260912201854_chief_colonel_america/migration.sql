PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_supplier_invoices` (
	`id` text PRIMARY KEY,
	`request_id` text NOT NULL UNIQUE,
	`request` text NOT NULL,
	`supplier_id` text NOT NULL,
	`document_kind` text DEFAULT 'invoice' NOT NULL,
	`source_invoice_id` text,
	`tax_treatment` text DEFAULT 'france' NOT NULL,
	`reference` text NOT NULL,
	`invoice_date` text NOT NULL,
	`due_date` text NOT NULL,
	`currency` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`net_total_cents` integer NOT NULL,
	`vat_total_cents` integer NOT NULL,
	`total_cents` integer NOT NULL,
	`functional_currency` text,
	`exchange_rate_date` text,
	`foreign_units_per_functional_unit_nanos` integer,
	`functional_net_total_cents` integer,
	`functional_vat_total_cents` integer,
	`functional_total_cents` integer,
	`status` text DEFAULT 'draft' NOT NULL,
	`source` text NOT NULL,
	`source_file_name` text,
	`external_submission_id` text,
	`confirmed_at` integer,
	`approved_at` integer,
	`version` integer DEFAULT 1 NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_supplier_invoices_supplier_id_suppliers_id_fk` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`),
	CONSTRAINT `fk_supplier_invoices_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`),
	CONSTRAINT "supplier_invoices_id_ulid_check" CHECK("id" is not null and length("id") = 26 and "id" not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr("id", 1, 1) between '0' and '7'),
	CONSTRAINT "supplier_invoices_request_id_check" CHECK(length("request_id") = 36),
	CONSTRAINT "supplier_invoices_request_json_check" CHECK(json_valid("request")),
	CONSTRAINT "supplier_invoices_reference_check" CHECK(length(trim("reference")) between 1 and 80),
	CONSTRAINT "supplier_invoices_dates_check" CHECK("invoice_date" glob '????-??-??' and "due_date" glob '????-??-??' and "due_date" >= "invoice_date"),
	CONSTRAINT "supplier_invoices_currency_check" CHECK("currency" glob '[A-Z][A-Z][A-Z]'),
	CONSTRAINT "supplier_invoices_totals_check" CHECK("net_total_cents" >= 0 and "vat_total_cents" >= 0 and (("tax_treatment" in ('eu-reverse-charge', 'non-eu-import') and "total_cents" = "net_total_cents") or ("tax_treatment" in ('france', 'foreign-local-tax') and "total_cents" = "net_total_cents" + "vat_total_cents"))),
	CONSTRAINT "supplier_invoices_functional_values_check" CHECK(("functional_currency" is null and "exchange_rate_date" is null and "foreign_units_per_functional_unit_nanos" is null and "functional_net_total_cents" is null and "functional_vat_total_cents" is null and "functional_total_cents" is null) or ("functional_currency" glob '[A-Z][A-Z][A-Z]' and strftime('%Y-%m-%d', "exchange_rate_date", '+0 days') = "exchange_rate_date" and "foreign_units_per_functional_unit_nanos" between 1 and 9007199254740991 and "functional_net_total_cents" between 0 and 9007199254740991 and "functional_vat_total_cents" between 0 and 9007199254740991 and (("tax_treatment" in ('eu-reverse-charge', 'non-eu-import') and "functional_total_cents" = "functional_net_total_cents") or ("tax_treatment" in ('france', 'foreign-local-tax') and "functional_total_cents" = "functional_net_total_cents" + "functional_vat_total_cents")))),
	CONSTRAINT "supplier_invoices_status_check" CHECK("status" in ('draft', 'confirmed', 'approved', 'paid', 'cancelled')),
	CONSTRAINT "supplier_invoices_document_kind_check" CHECK("document_kind" in ('invoice','credit') and (("document_kind" = 'invoice' and "source_invoice_id" is null) or ("document_kind" = 'credit' and "source_invoice_id" is not null))),
	CONSTRAINT "supplier_invoices_source_check" CHECK("source" in ('manual', 'ocr')),
	CONSTRAINT "supplier_invoices_version_check" CHECK("version" > 0),
	CONSTRAINT "supplier_invoices_timestamps_check" CHECK("updated_at" >= "created_at")
);
--> statement-breakpoint
INSERT INTO `__new_supplier_invoices`(`id`, `request_id`, `request`, `supplier_id`, `document_kind`, `source_invoice_id`, `tax_treatment`, `reference`, `invoice_date`, `due_date`, `currency`, `notes`, `net_total_cents`, `vat_total_cents`, `total_cents`, `functional_currency`, `exchange_rate_date`, `foreign_units_per_functional_unit_nanos`, `functional_net_total_cents`, `functional_vat_total_cents`, `functional_total_cents`, `status`, `source`, `source_file_name`, `external_submission_id`, `confirmed_at`, `approved_at`, `version`, `created_by_user_id`, `created_at`, `updated_at`) SELECT `id`, `request_id`, `request`, `supplier_id`, `document_kind`, `source_invoice_id`, `tax_treatment`, `reference`, `invoice_date`, `due_date`, `currency`, `notes`, `net_total_cents`, `vat_total_cents`, `total_cents`, `functional_currency`, `exchange_rate_date`, `foreign_units_per_functional_unit_nanos`, `functional_net_total_cents`, `functional_vat_total_cents`, `functional_total_cents`, `status`, `source`, `source_file_name`, `external_submission_id`, `confirmed_at`, `approved_at`, `version`, `created_by_user_id`, `created_at`, `updated_at` FROM `supplier_invoices`;--> statement-breakpoint
DROP TABLE `supplier_invoices`;--> statement-breakpoint
ALTER TABLE `__new_supplier_invoices` RENAME TO `supplier_invoices`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `supplier_invoices_supplier_reference_unique` ON `supplier_invoices` (`supplier_id`,`reference`);--> statement-breakpoint
CREATE INDEX `supplier_invoices_due_date_index` ON `supplier_invoices` (`due_date`);--> statement-breakpoint
CREATE INDEX `supplier_invoices_status_index` ON `supplier_invoices` (`status`);
--> statement-breakpoint
CREATE TRIGGER `supplier_credit_source_insert` BEFORE INSERT ON `supplier_invoices`
WHEN NEW.`document_kind` = 'credit' AND NOT EXISTS (
	SELECT 1 FROM `supplier_invoices` source
	WHERE source.`id` = NEW.`source_invoice_id`
	  AND source.`document_kind` = 'invoice'
	  AND source.`supplier_id` = NEW.`supplier_id`
	  AND source.`currency` = NEW.`currency`
	  AND source.`tax_treatment` = NEW.`tax_treatment`
)
BEGIN SELECT RAISE(ABORT, 'database.trigger.supplier_credit_source_insert'); END;
--> statement-breakpoint
CREATE TRIGGER `supplier_credit_source_update` BEFORE UPDATE OF `document_kind`, `source_invoice_id`, `supplier_id`, `currency`, `tax_treatment` ON `supplier_invoices`
WHEN NEW.`document_kind` = 'credit' AND NOT EXISTS (
	SELECT 1 FROM `supplier_invoices` source
	WHERE source.`id` = NEW.`source_invoice_id`
	  AND source.`document_kind` = 'invoice'
	  AND source.`supplier_id` = NEW.`supplier_id`
	  AND source.`currency` = NEW.`currency`
	  AND source.`tax_treatment` = NEW.`tax_treatment`
)
BEGIN SELECT RAISE(ABORT, 'database.trigger.supplier_credit_source_update'); END;
--> statement-breakpoint
CREATE TRIGGER `supplier_invoices_confirmed_values_immutable` BEFORE UPDATE ON `supplier_invoices`
WHEN OLD.`status` <> 'draft' AND (
	NEW.`id` IS NOT OLD.`id`
	OR NEW.`request_id` IS NOT OLD.`request_id`
	OR NEW.`request` IS NOT OLD.`request`
	OR NEW.`supplier_id` IS NOT OLD.`supplier_id`
	OR NEW.`document_kind` IS NOT OLD.`document_kind`
	OR NEW.`source_invoice_id` IS NOT OLD.`source_invoice_id`
	OR NEW.`tax_treatment` IS NOT OLD.`tax_treatment`
	OR NEW.`reference` IS NOT OLD.`reference`
	OR NEW.`invoice_date` IS NOT OLD.`invoice_date`
	OR NEW.`due_date` IS NOT OLD.`due_date`
	OR NEW.`currency` IS NOT OLD.`currency`
	OR NEW.`notes` IS NOT OLD.`notes`
	OR NEW.`net_total_cents` IS NOT OLD.`net_total_cents`
	OR NEW.`vat_total_cents` IS NOT OLD.`vat_total_cents`
	OR NEW.`total_cents` IS NOT OLD.`total_cents`
	OR NEW.`functional_currency` IS NOT OLD.`functional_currency`
	OR NEW.`exchange_rate_date` IS NOT OLD.`exchange_rate_date`
	OR NEW.`foreign_units_per_functional_unit_nanos` IS NOT OLD.`foreign_units_per_functional_unit_nanos`
	OR NEW.`functional_net_total_cents` IS NOT OLD.`functional_net_total_cents`
	OR NEW.`functional_vat_total_cents` IS NOT OLD.`functional_vat_total_cents`
	OR NEW.`functional_total_cents` IS NOT OLD.`functional_total_cents`
	OR NEW.`source` IS NOT OLD.`source`
	OR NEW.`source_file_name` IS NOT OLD.`source_file_name`
	OR NEW.`external_submission_id` IS NOT OLD.`external_submission_id`
	OR NEW.`confirmed_at` IS NOT OLD.`confirmed_at`
	OR NEW.`created_by_user_id` IS NOT OLD.`created_by_user_id`
	OR NEW.`created_at` IS NOT OLD.`created_at`
)
BEGIN SELECT RAISE(ABORT, 'database.trigger.supplier_invoices_confirmed_values_immutable'); END;
