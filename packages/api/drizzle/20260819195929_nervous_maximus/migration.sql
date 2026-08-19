UPDATE `users`
SET `disabled_at` = COALESCE(`disabled_at`, (SELECT `archived_at` FROM `clients` WHERE `clients`.`id` = `users`.`id`)),
	`updated_at` = MAX(`updated_at`, COALESCE((SELECT `archived_at` FROM `clients` WHERE `clients`.`id` = `users`.`id`), `updated_at`))
WHERE `kind` = 'client';--> statement-breakpoint
UPDATE `access_credentials`
SET `revoked_at` = COALESCE(`revoked_at`, (SELECT `disabled_at` FROM `users` WHERE `users`.`id` = `access_credentials`.`user_id`))
WHERE EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `access_credentials`.`user_id` AND `users`.`disabled_at` IS NOT NULL);--> statement-breakpoint
UPDATE `sessions`
SET `revoked_at` = COALESCE(`revoked_at`, (SELECT `disabled_at` FROM `users` WHERE `users`.`id` = `sessions`.`user_id`))
WHERE EXISTS (SELECT 1 FROM `users` WHERE `users`.`id` = `sessions`.`user_id` AND `users`.`disabled_at` IS NOT NULL);--> statement-breakpoint
CREATE TABLE `__new_clients` (
	`id` text PRIMARY KEY,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_clients_id_users_id_fk` FOREIGN KEY (`id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
	CONSTRAINT "clients_id_ulid_check" CHECK("id" is not null and length("id") = 26 and "id" not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr("id", 1, 1) between '0' and '7'),
	CONSTRAINT "clients_timestamps_check" CHECK("updated_at" >= "created_at")
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
END;
