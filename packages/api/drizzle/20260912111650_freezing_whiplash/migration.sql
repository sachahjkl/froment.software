CREATE TABLE `supplier_creation_requests` (
	`request_id` text PRIMARY KEY,
	`created_by_user_id` text NOT NULL,
	`supplier_id` text NOT NULL UNIQUE,
	`request` text NOT NULL,
	`result` text NOT NULL,
	CONSTRAINT `fk_supplier_creation_requests_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`),
	CONSTRAINT `fk_supplier_creation_requests_supplier_id_suppliers_id_fk` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE CASCADE,
	CONSTRAINT "supplier_creation_requests_id_check" CHECK("request_id" glob '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f]-4[0-9a-f][0-9a-f][0-9a-f]-[89ab][0-9a-f][0-9a-f][0-9a-f]-[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]')
);
--> statement-breakpoint
CREATE TABLE `suppliers` (
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
	CONSTRAINT "suppliers_payment_terms_check" CHECK("payment_terms_days" between 0 and 365),
	CONSTRAINT "suppliers_archived_check" CHECK("archived" in (0, 1)),
	CONSTRAINT "suppliers_timestamps_check" CHECK("updated_at" >= "created_at")
);
--> statement-breakpoint
CREATE INDEX `suppliers_display_name_index` ON `suppliers` (`display_name`);
--> statement-breakpoint
INSERT INTO `permissions` (`code`) VALUES
	('supplier.read'),
	('supplier.create'),
	('supplier.update'),
	('supplier.archive');
--> statement-breakpoint
INSERT OR IGNORE INTO `role_permissions` (`role_id`, `permission_code`)
SELECT `roles`.`id`, `permissions`.`code`
FROM `roles` CROSS JOIN `permissions`
WHERE `roles`.`name` = 'administrator' AND `permissions`.`code` LIKE 'supplier.%';
--> statement-breakpoint
INSERT OR IGNORE INTO `role_permissions` (`role_id`, `permission_code`)
SELECT `user_roles`.`role_id`, `permissions`.`code`
FROM `team_members`
JOIN `user_roles` ON `user_roles`.`user_id` = `team_members`.`user_id`
JOIN `permissions` ON `permissions`.`code` LIKE 'supplier.%'
WHERE `team_members`.`profile` = 'accountant';
--> statement-breakpoint
INSERT OR IGNORE INTO `role_permissions` (`role_id`, `permission_code`)
SELECT `user_roles`.`role_id`, 'supplier.read'
FROM `team_members`
JOIN `user_roles` ON `user_roles`.`user_id` = `team_members`.`user_id`
WHERE `team_members`.`profile` = 'collaborator';
