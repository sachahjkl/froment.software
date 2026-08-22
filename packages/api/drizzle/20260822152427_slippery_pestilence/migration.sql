CREATE TABLE `refresh_sessions` (
	`id` text PRIMARY KEY,
	`family_id` text NOT NULL,
	`user_id` text NOT NULL,
	`token_hmac` blob NOT NULL,
	`created_at` integer NOT NULL,
	`rotated_at` integer NOT NULL,
	`absolute_expires_at` integer NOT NULL,
	`consumed_at` integer,
	`revoked_at` integer,
	CONSTRAINT `fk_refresh_sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
	CONSTRAINT "refresh_sessions_id_ulid_check" CHECK("id" is not null and length("id") = 26 and "id" not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr("id", 1, 1) between '0' and '7'),
	CONSTRAINT "refresh_sessions_family_id_ulid_check" CHECK("family_id" is not null and length("family_id") = 26 and "family_id" not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr("family_id", 1, 1) between '0' and '7'),
	CONSTRAINT "refresh_sessions_token_hmac_check" CHECK(typeof("token_hmac") = 'blob' and length("token_hmac") = 32),
	CONSTRAINT "refresh_sessions_timestamps_check" CHECK("rotated_at" >= "created_at" and "absolute_expires_at" > "created_at" and ("consumed_at" is null or "consumed_at" >= "created_at") and ("revoked_at" is null or "revoked_at" >= "created_at"))
);
--> statement-breakpoint
DROP TRIGGER IF EXISTS `clients_revoke_before_delete`;--> statement-breakpoint
DELETE FROM `password_credentials`;--> statement-breakpoint
DROP INDEX IF EXISTS `access_credentials_secret_hmac_unique`;--> statement-breakpoint
DROP INDEX IF EXISTS `access_credentials_user_id_index`;--> statement-breakpoint
DROP INDEX IF EXISTS `sessions_token_hmac_unique`;--> statement-breakpoint
DROP INDEX IF EXISTS `sessions_user_id_index`;--> statement-breakpoint
DROP INDEX IF EXISTS `sessions_idle_expiry_index`;--> statement-breakpoint
DROP INDEX IF EXISTS `sessions_absolute_expiry_index`;--> statement-breakpoint
CREATE UNIQUE INDEX `refresh_sessions_token_hmac_unique` ON `refresh_sessions` (`token_hmac`);--> statement-breakpoint
CREATE INDEX `refresh_sessions_user_id_index` ON `refresh_sessions` (`user_id`,`revoked_at`);--> statement-breakpoint
CREATE INDEX `refresh_sessions_family_id_index` ON `refresh_sessions` (`family_id`,`revoked_at`);--> statement-breakpoint
CREATE INDEX `refresh_sessions_expiry_index` ON `refresh_sessions` (`absolute_expires_at`);--> statement-breakpoint
DROP TABLE `access_credentials`;--> statement-breakpoint
DROP TABLE `sessions`;--> statement-breakpoint
CREATE TRIGGER `clients_revoke_before_delete`
BEFORE DELETE ON `clients`
BEGIN
	UPDATE `users` SET `disabled_at` = COALESCE(`disabled_at`, CAST(unixepoch('subsec') * 1000 AS INTEGER)), `updated_at` = MAX(`updated_at`, CAST(unixepoch('subsec') * 1000 AS INTEGER)) WHERE `id` = OLD.`id`;
	UPDATE `refresh_sessions` SET `revoked_at` = COALESCE(`revoked_at`, (SELECT `disabled_at` FROM `users` WHERE `id` = OLD.`id`)) WHERE `user_id` = OLD.`id`;
END;
