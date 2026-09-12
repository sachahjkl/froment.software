ALTER TABLE `suppliers` ADD `tax_treatment` text DEFAULT 'france' NOT NULL;--> statement-breakpoint
ALTER TABLE `suppliers` ADD `vies_validated_at` integer;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_suppliers` (
	`id` text PRIMARY KEY,
	`display_name` text NOT NULL,
	`address_line_1` text DEFAULT '' NOT NULL,
	`address_line_2` text DEFAULT '' NOT NULL,
	`postal_code` text DEFAULT '' NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`country` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`registration_number` text DEFAULT '' NOT NULL,
	`vat_number` text DEFAULT '' NOT NULL,
	`tax_treatment` text DEFAULT 'france' NOT NULL,
	`vies_validated_at` integer,
	`default_currency` text NOT NULL,
	`payment_terms_days` integer DEFAULT 30 NOT NULL,
	`iban` text DEFAULT '' NOT NULL,
	`bic` text DEFAULT '' NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "suppliers_id_ulid_check" CHECK("id" is not null and length("id") = 26 and "id" not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr("id", 1, 1) between '0' and '7'),
	CONSTRAINT "suppliers_display_name_check" CHECK(length(trim("display_name")) between 1 and 160),
	CONSTRAINT "suppliers_fields_check" CHECK(length("address_line_1") <= 160 and length("address_line_2") <= 160 and length("postal_code") <= 32 and length("city") <= 120 and length("country") <= 120 and length("email") <= 254 and length("phone") <= 64 and length("registration_number") <= 64 and length("vat_number") <= 64 and length("iban") <= 34 and length("bic") <= 11),
	CONSTRAINT "suppliers_currency_check" CHECK("default_currency" glob '[A-Z][A-Z][A-Z]'),
	CONSTRAINT "suppliers_tax_treatment_check" CHECK("tax_treatment" in ('france','eu-reverse-charge','non-eu-import','foreign-local-tax')),
	CONSTRAINT "suppliers_payment_terms_check" CHECK("payment_terms_days" between 0 and 365),
	CONSTRAINT "suppliers_archived_check" CHECK("archived" in (0, 1)),
	CONSTRAINT "suppliers_timestamps_check" CHECK("updated_at" >= "created_at")
);
--> statement-breakpoint
INSERT INTO `__new_suppliers`(`id`, `display_name`, `address_line_1`, `address_line_2`, `postal_code`, `city`, `country`, `email`, `phone`, `registration_number`, `vat_number`, `default_currency`, `payment_terms_days`, `iban`, `bic`, `archived`, `created_at`, `updated_at`) SELECT `id`, `display_name`, `address_line_1`, `address_line_2`, `postal_code`, `city`, `country`, `email`, `phone`, `registration_number`, `vat_number`, `default_currency`, `payment_terms_days`, `iban`, `bic`, `archived`, `created_at`, `updated_at` FROM `suppliers`;--> statement-breakpoint
DROP TABLE `suppliers`;--> statement-breakpoint
ALTER TABLE `__new_suppliers` RENAME TO `suppliers`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_supplier_invoice_analysis_settings` (
	`id` integer PRIMARY KEY,
	`adapter` text NOT NULL,
	`endpoint` text,
	`encrypted_api_key` text,
	`encryption_iv` text,
	`encryption_tag` text,
	`updated_at` integer,
	CONSTRAINT "supplier_invoice_analysis_settings_singleton_check" CHECK("id" = 1),
	CONSTRAINT "supplier_invoice_analysis_settings_adapter_check" CHECK("adapter" in ('local', 'openai')),
	CONSTRAINT "supplier_invoice_analysis_settings_encryption_check" CHECK(("encrypted_api_key" is null and "encryption_iv" is null and "encryption_tag" is null) or ("encrypted_api_key" is not null and "encryption_iv" is not null and "encryption_tag" is not null))
);
--> statement-breakpoint
INSERT INTO `__new_supplier_invoice_analysis_settings`(`id`, `adapter`, `endpoint`, `encrypted_api_key`, `encryption_iv`, `encryption_tag`, `updated_at`) SELECT `id`, `adapter`, `endpoint`, `encrypted_api_key`, `encryption_iv`, `encryption_tag`, `updated_at` FROM `supplier_invoice_analysis_settings`;--> statement-breakpoint
DROP TABLE `supplier_invoice_analysis_settings`;--> statement-breakpoint
ALTER TABLE `__new_supplier_invoice_analysis_settings` RENAME TO `supplier_invoice_analysis_settings`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `suppliers_display_name_index` ON `suppliers` (`display_name`);