CREATE TABLE `supplier_payment_batch_items` (
	`batch_id` text NOT NULL,
	`invoice_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	CONSTRAINT `supplier_payment_batch_items_pk` PRIMARY KEY(`batch_id`, `invoice_id`),
	CONSTRAINT `fk_supplier_payment_batch_items_batch_id_supplier_payment_batches_id_fk` FOREIGN KEY (`batch_id`) REFERENCES `supplier_payment_batches`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_supplier_payment_batch_items_invoice_id_supplier_invoices_id_fk` FOREIGN KEY (`invoice_id`) REFERENCES `supplier_invoices`(`id`),
	CONSTRAINT "supplier_payment_batch_items_amount_check" CHECK("amount_cents" > 0)
);
--> statement-breakpoint
CREATE TABLE `supplier_payment_batches` (
	`id` text PRIMARY KEY,
	`request_id` text NOT NULL UNIQUE,
	`request` text NOT NULL,
	`message_id` text NOT NULL UNIQUE,
	`execution_date` text NOT NULL,
	`transaction_count` integer NOT NULL,
	`control_sum_cents` integer NOT NULL,
	`content` blob NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_supplier_payment_batches_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`),
	CONSTRAINT "supplier_payment_batches_id_ulid_check" CHECK("id" is not null and length("id") = 26 and "id" not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr("id", 1, 1) between '0' and '7'),
	CONSTRAINT "supplier_payment_batches_request_id_check" CHECK(length("request_id") = 36),
	CONSTRAINT "supplier_payment_batches_request_json_check" CHECK(json_valid("request")),
	CONSTRAINT "supplier_payment_batches_message_id_check" CHECK(length("message_id") between 1 and 35),
	CONSTRAINT "supplier_payment_batches_values_check" CHECK("execution_date" glob '????-??-??' and "transaction_count" between 1 and 100 and "control_sum_cents" between 1 and 900000000000000 and length("content") > 0)
);
--> statement-breakpoint
ALTER TABLE `issuer_settings` ADD `iban` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `issuer_settings` ADD `bic` text DEFAULT '' NOT NULL;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_issuer_settings` (
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
	`iban` text DEFAULT '' NOT NULL,
	`bic` text DEFAULT '' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "issuer_settings_singleton_check" CHECK("id" = 1),
	CONSTRAINT "issuer_settings_version_check" CHECK("version" between 1 and 9007199254740991),
	CONSTRAINT "issuer_settings_fields_check" CHECK(length(trim("display_name")) between 1 and 160 and length("address_line_1") <= 160 and length("address_line_2") <= 160 and length("postal_code") <= 32 and length("city") <= 120 and length("country") <= 120 and length("email") <= 254 and length("phone") <= 64 and length("registration_number") <= 64 and length("vat_number") <= 64 and length("iban") <= 42 and length("bic") <= 11)
);
--> statement-breakpoint
INSERT INTO `__new_issuer_settings`(`id`, `display_name`, `address_line_1`, `address_line_2`, `postal_code`, `city`, `country`, `email`, `phone`, `registration_number`, `vat_number`, `version`, `updated_at`) SELECT `id`, `display_name`, `address_line_1`, `address_line_2`, `postal_code`, `city`, `country`, `email`, `phone`, `registration_number`, `vat_number`, `version`, `updated_at` FROM `issuer_settings`;--> statement-breakpoint
DROP TABLE `issuer_settings`;--> statement-breakpoint
ALTER TABLE `__new_issuer_settings` RENAME TO `issuer_settings`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `supplier_payment_batch_items_invoice_id_index` ON `supplier_payment_batch_items` (`invoice_id`);--> statement-breakpoint
CREATE INDEX `supplier_payment_batches_created_at_index` ON `supplier_payment_batches` (`created_at`);
--> statement-breakpoint
INSERT INTO `permissions` (`code`) VALUES ('supplier-invoice.pay');
--> statement-breakpoint
INSERT OR IGNORE INTO `role_permissions` (`role_id`, `permission_code`)
SELECT `roles`.`id`, 'supplier-invoice.pay'
FROM `roles`
WHERE `roles`.`name` = 'administrator';
--> statement-breakpoint
INSERT OR IGNORE INTO `role_permissions` (`role_id`, `permission_code`)
SELECT `user_roles`.`role_id`, 'supplier-invoice.pay'
FROM `team_members`
JOIN `user_roles` ON `user_roles`.`user_id` = `team_members`.`user_id`
WHERE `team_members`.`profile` = 'accountant';
