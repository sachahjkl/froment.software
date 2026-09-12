ALTER TABLE `clients` ADD `phone` text DEFAULT '' NOT NULL;--> statement-breakpoint
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
	`phone` text DEFAULT '' NOT NULL,
	CONSTRAINT `fk_clients_id_users_id_fk` FOREIGN KEY (`id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
	CONSTRAINT "clients_id_ulid_check" CHECK("id" is not null and length("id") = 26 and "id" not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr("id", 1, 1) between '0' and '7'),
	CONSTRAINT "clients_timestamps_check" CHECK("updated_at" >= "created_at"),
	CONSTRAINT "clients_document_fields_check" CHECK(length("address_line_1") <= 160 and length("address_line_2") <= 160 and length("postal_code") <= 32 and length("city") <= 120 and length("country") <= 120 and length("email") <= 254 and length("phone") <= 64)
);
--> statement-breakpoint
INSERT INTO `__new_clients`(`id`, `created_at`, `updated_at`, `address_line_1`, `address_line_2`, `postal_code`, `city`, `country`, `email`) SELECT `id`, `created_at`, `updated_at`, `address_line_1`, `address_line_2`, `postal_code`, `city`, `country`, `email` FROM `clients`;--> statement-breakpoint
DROP TABLE `clients`;--> statement-breakpoint
ALTER TABLE `__new_clients` RENAME TO `clients`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `published_quote_revisions_immutable_update`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `invoice_revisions_no_update`;--> statement-breakpoint
UPDATE `quote_revisions`
SET `render_snapshot` = json_set(`render_snapshot`, '$.client.phone', '')
WHERE `render_snapshot` IS NOT NULL;--> statement-breakpoint
UPDATE `invoice_revisions`
SET `render_snapshot` = json_set(`render_snapshot`, '$.client.phone', '')
WHERE `render_snapshot` IS NOT NULL;--> statement-breakpoint
CREATE TRIGGER `published_quote_revisions_immutable_update` BEFORE UPDATE ON `quote_revisions` WHEN EXISTS (SELECT 1 FROM `document_artifacts` WHERE `revision_id` = OLD.`id`) BEGIN SELECT RAISE(ABORT, 'database.trigger.published_quote_revisions_immutable_update'); END;--> statement-breakpoint
CREATE TRIGGER `invoice_revisions_no_update` BEFORE UPDATE ON `invoice_revisions` BEGIN SELECT RAISE(ABORT, 'database.trigger.invoice_revisions_no_update'); END;--> statement-breakpoint
CREATE TRIGGER `clients_kind_before_insert` BEFORE INSERT ON `clients` BEGIN SELECT RAISE(ABORT, 'database.trigger.clients_kind_before_insert') WHERE NOT EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = NEW.`id` AND `users`.`kind` = 'client'); END;--> statement-breakpoint
CREATE TRIGGER `clients_revoke_before_delete`
BEFORE DELETE ON `clients`
BEGIN
	UPDATE `users` SET `disabled_at` = COALESCE(`disabled_at`, CAST(unixepoch('subsec') * 1000 AS INTEGER)), `updated_at` = MAX(`updated_at`, CAST(unixepoch('subsec') * 1000 AS INTEGER)) WHERE `id` = OLD.`id`;
	UPDATE `refresh_sessions` SET `revoked_at` = COALESCE(`revoked_at`, (SELECT `disabled_at` FROM `users` WHERE `id` = OLD.`id`)) WHERE `user_id` = OLD.`id`;
END;--> statement-breakpoint
CREATE TRIGGER `client_access_accounts_cleanup_before_client_delete`
BEFORE DELETE ON `clients`
BEGIN
	DELETE FROM `users`
	WHERE `id` IN (
		SELECT `user_id`
		FROM `client_access_accounts`
		WHERE `client_id` = OLD.`id` AND `user_id` <> OLD.`id`
	);
END;--> statement-breakpoint
PRAGMA foreign_keys=ON;
