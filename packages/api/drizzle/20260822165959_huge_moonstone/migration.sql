DROP TRIGGER IF EXISTS `clients_revoke_before_delete`;--> statement-breakpoint
ALTER TABLE `refresh_sessions` ADD `replacement_session_id` text;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_refresh_sessions` (
	`id` text PRIMARY KEY,
	`family_id` text NOT NULL,
	`user_id` text NOT NULL,
	`token_hmac` blob NOT NULL,
	`created_at` integer NOT NULL,
	`rotated_at` integer NOT NULL,
	`absolute_expires_at` integer NOT NULL,
	`consumed_at` integer,
	`replacement_session_id` text,
	`revoked_at` integer,
	CONSTRAINT `fk_refresh_sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
	CONSTRAINT "refresh_sessions_id_ulid_check" CHECK("id" is not null and length("id") = 26 and "id" not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr("id", 1, 1) between '0' and '7'),
	CONSTRAINT "refresh_sessions_family_id_ulid_check" CHECK("family_id" is not null and length("family_id") = 26 and "family_id" not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr("family_id", 1, 1) between '0' and '7'),
	CONSTRAINT "refresh_sessions_token_hmac_check" CHECK(typeof("token_hmac") = 'blob' and length("token_hmac") = 32),
	CONSTRAINT "refresh_sessions_replacement_session_id_check" CHECK("replacement_session_id" is null or (length("replacement_session_id") = 26 and "replacement_session_id" not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr("replacement_session_id", 1, 1) between '0' and '7')),
	CONSTRAINT "refresh_sessions_timestamps_check" CHECK("rotated_at" >= "created_at" and "absolute_expires_at" > "created_at" and ("consumed_at" is null or "consumed_at" >= "created_at") and ("revoked_at" is null or "revoked_at" >= "created_at"))
);
--> statement-breakpoint
INSERT INTO `__new_refresh_sessions`(`id`, `family_id`, `user_id`, `token_hmac`, `created_at`, `rotated_at`, `absolute_expires_at`, `consumed_at`, `revoked_at`) SELECT `id`, `family_id`, `user_id`, `token_hmac`, `created_at`, `rotated_at`, `absolute_expires_at`, `consumed_at`, `revoked_at` FROM `refresh_sessions`;--> statement-breakpoint
DROP TABLE `refresh_sessions`;--> statement-breakpoint
ALTER TABLE `__new_refresh_sessions` RENAME TO `refresh_sessions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `refresh_sessions_token_hmac_unique` ON `refresh_sessions` (`token_hmac`);--> statement-breakpoint
CREATE UNIQUE INDEX `refresh_sessions_replacement_session_id_unique` ON `refresh_sessions` (`replacement_session_id`);--> statement-breakpoint
CREATE INDEX `refresh_sessions_user_id_index` ON `refresh_sessions` (`user_id`,`revoked_at`);--> statement-breakpoint
CREATE INDEX `refresh_sessions_family_id_index` ON `refresh_sessions` (`family_id`,`revoked_at`);--> statement-breakpoint
CREATE INDEX `refresh_sessions_expiry_index` ON `refresh_sessions` (`absolute_expires_at`);
--> statement-breakpoint
CREATE TRIGGER `clients_revoke_before_delete`
BEFORE DELETE ON `clients`
BEGIN
	UPDATE `users` SET `disabled_at` = COALESCE(`disabled_at`, CAST(unixepoch('subsec') * 1000 AS INTEGER)), `updated_at` = MAX(`updated_at`, CAST(unixepoch('subsec') * 1000 AS INTEGER)) WHERE `id` = OLD.`id`;
	UPDATE `refresh_sessions` SET `revoked_at` = COALESCE(`revoked_at`, (SELECT `disabled_at` FROM `users` WHERE `id` = OLD.`id`)) WHERE `user_id` = OLD.`id`;
END;
