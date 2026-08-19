CREATE TABLE `issuer_settings` (
	`id` integer PRIMARY KEY,
	`display_name` text NOT NULL,
	`address_line_1` text NOT NULL,
	`address_line_2` text NOT NULL,
	`postal_code` text NOT NULL,
	`city` text NOT NULL,
	`country` text NOT NULL,
	`email` text NOT NULL,
	`phone` text NOT NULL,
	`registration_number` text NOT NULL,
	`vat_number` text NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "issuer_settings_singleton_check" CHECK("id" = 1),
	CONSTRAINT "issuer_settings_fields_check" CHECK(length(trim("display_name")) between 1 and 160 and length("address_line_1") <= 160 and length("address_line_2") <= 160 and length("postal_code") <= 32 and length("city") <= 120 and length("country") <= 120 and length("email") <= 254 and length("phone") <= 64 and length("registration_number") <= 64 and length("vat_number") <= 64)
);
--> statement-breakpoint
INSERT INTO `issuer_settings`
  (`id`, `display_name`, `address_line_1`, `address_line_2`, `postal_code`, `city`, `country`, `email`, `phone`, `registration_number`, `vat_number`, `updated_at`)
VALUES (1, 'Froment Software', '', '', '', '', '', '', '', '', '', 0);
--> statement-breakpoint
ALTER TABLE `clients` ADD `address_line_1` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `clients` ADD `address_line_2` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `clients` ADD `postal_code` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `clients` ADD `city` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `clients` ADD `country` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `clients` ADD `email` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `quote_revisions` ADD `template_id` text;--> statement-breakpoint
ALTER TABLE `quote_revisions` ADD `template_version` integer;--> statement-breakpoint
ALTER TABLE `quote_revisions` ADD `render_snapshot` text;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_clients` (
	`id` text PRIMARY KEY,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`address_line_1` text DEFAULT '' NOT NULL,
	`address_line_2` text DEFAULT '' NOT NULL,
	`postal_code` text DEFAULT '' NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`country` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	CONSTRAINT `fk_clients_id_users_id_fk` FOREIGN KEY (`id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
	CONSTRAINT "clients_id_ulid_check" CHECK("id" is not null and length("id") = 26 and "id" not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr("id", 1, 1) between '0' and '7'),
	CONSTRAINT "clients_timestamps_check" CHECK("updated_at" >= "created_at"),
	CONSTRAINT "clients_document_fields_check" CHECK(length("address_line_1") <= 160 and length("address_line_2") <= 160 and length("postal_code") <= 32 and length("city") <= 120 and length("country") <= 120 and length("email") <= 254)
);
--> statement-breakpoint
INSERT INTO `__new_clients`(`id`, `created_at`, `updated_at`) SELECT `id`, `created_at`, `updated_at` FROM `clients`;--> statement-breakpoint
DROP TABLE `clients`;--> statement-breakpoint
ALTER TABLE `__new_clients` RENAME TO `clients`;--> statement-breakpoint
CREATE TRIGGER `clients_kind_before_insert`
BEFORE INSERT ON `clients`
BEGIN
	SELECT RAISE(ABORT, 'client user required')
	WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = NEW.`id` AND `users`.`kind` = 'client');
END;--> statement-breakpoint
CREATE TRIGGER `clients_revoke_before_delete`
BEFORE DELETE ON `clients`
BEGIN
	UPDATE `users` SET `disabled_at` = COALESCE(`disabled_at`, CAST(unixepoch('subsec') * 1000 AS INTEGER)), `updated_at` = MAX(`updated_at`, CAST(unixepoch('subsec') * 1000 AS INTEGER)) WHERE `id` = OLD.`id`;
	UPDATE `access_credentials` SET `revoked_at` = COALESCE(`revoked_at`, (SELECT `disabled_at` FROM `users` WHERE `id` = OLD.`id`)) WHERE `user_id` = OLD.`id`;
	UPDATE `sessions` SET `revoked_at` = COALESCE(`revoked_at`, (SELECT `disabled_at` FROM `users` WHERE `id` = OLD.`id`)) WHERE `user_id` = OLD.`id`;
END;--> statement-breakpoint
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
INSERT INTO `__new_quote_revisions`(`id`, `quote_id`, `version`, `client_display_name`, `title`, `conditions`, `currency`, `net_total_cents`, `vat_total_cents`, `total_cents`, `created_at`, `created_by_user_id`) SELECT `id`, `quote_id`, `version`, `client_display_name`, `title`, `conditions`, `currency`, `net_total_cents`, `vat_total_cents`, `total_cents`, `created_at`, `created_by_user_id` FROM `quote_revisions`;--> statement-breakpoint
DROP TABLE `quote_revisions`;--> statement-breakpoint
ALTER TABLE `__new_quote_revisions` RENAME TO `quote_revisions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `quote_revisions_quote_id_version_unique` ON `quote_revisions` (`quote_id`,`version`);--> statement-breakpoint
CREATE INDEX `quote_revisions_created_by_user_id_index` ON `quote_revisions` (`created_by_user_id`);
