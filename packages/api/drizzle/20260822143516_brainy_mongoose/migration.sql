ALTER TABLE `integration_token_permissions` RENAME TO `api_token_permissions`;--> statement-breakpoint
ALTER TABLE `integration_tokens` RENAME TO `api_tokens`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
DROP TRIGGER IF EXISTS `integration_tokens_delete_guard`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `integration_tokens_immutable_guard`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `integration_token_permissions_update_guard`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `integration_token_permissions_delete_guard`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `integration_tokens_name_insert_guard`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `integration_tokens_active_name_insert_guard`;--> statement-breakpoint
UPDATE `api_token_permissions` SET `permission_code` = 'api-token.manage' WHERE `permission_code` = 'integration-token.manage';--> statement-breakpoint
UPDATE `role_permissions` SET `permission_code` = 'api-token.manage' WHERE `permission_code` = 'integration-token.manage';--> statement-breakpoint
UPDATE `permissions` SET `code` = 'api-token.manage' WHERE `code` = 'integration-token.manage';--> statement-breakpoint
CREATE TABLE `__new_api_tokens` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`token_hmac` blob NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`last_used_at` integer,
	`revoked_at` integer,
	`revoked_by_user_id` text,
	`rate_limit_per_minute` integer NOT NULL,
	CONSTRAINT `fk_api_tokens_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
	CONSTRAINT `fk_api_tokens_revoked_by_user_id_users_id_fk` FOREIGN KEY (`revoked_by_user_id`) REFERENCES `users`(`id`),
	CONSTRAINT "api_tokens_id_ulid_check" CHECK("id" is not null and length("id") = 26 and "id" not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr("id", 1, 1) between '0' and '7'),
	CONSTRAINT "api_tokens_name_check" CHECK(length(trim("name")) between 1 and 120),
	CONSTRAINT "api_tokens_token_hmac_check" CHECK(typeof("token_hmac") = 'blob' and length("token_hmac") = 32),
	CONSTRAINT "api_tokens_expiry_check" CHECK("expires_at" > "created_at"),
	CONSTRAINT "api_tokens_timestamps_check" CHECK(("last_used_at" is null or "last_used_at" >= "created_at") and ("revoked_at" is null or "revoked_at" >= "created_at")),
	CONSTRAINT "api_tokens_revocation_check" CHECK(("revoked_at" is null and "revoked_by_user_id" is null) or ("revoked_at" is not null and "revoked_by_user_id" is not null)),
	CONSTRAINT "api_tokens_rate_limit_check" CHECK("rate_limit_per_minute" between 1 and 600)
);
--> statement-breakpoint
INSERT INTO `__new_api_tokens`(`id`, `user_id`, `name`, `token_hmac`, `created_at`, `expires_at`, `last_used_at`, `revoked_at`, `revoked_by_user_id`, `rate_limit_per_minute`) SELECT `id`, `user_id`, `name`, `token_hmac`, `created_at`, `expires_at`, `last_used_at`, `revoked_at`, `revoked_by_user_id`, `rate_limit_per_minute` FROM `api_tokens`;--> statement-breakpoint
DROP TABLE `api_tokens`;--> statement-breakpoint
ALTER TABLE `__new_api_tokens` RENAME TO `api_tokens`;--> statement-breakpoint
CREATE TABLE `__new_api_token_permissions` (
	`token_id` text NOT NULL,
	`permission_code` text NOT NULL,
	CONSTRAINT `api_token_permissions_pk` PRIMARY KEY(`token_id`, `permission_code`),
	CONSTRAINT `fk_api_token_permissions_token_id_api_tokens_id_fk` FOREIGN KEY (`token_id`) REFERENCES `api_tokens`(`id`),
	CONSTRAINT `fk_api_token_permissions_permission_code_permissions_code_fk` FOREIGN KEY (`permission_code`) REFERENCES `permissions`(`code`)
);--> statement-breakpoint
INSERT INTO `__new_api_token_permissions`(`token_id`, `permission_code`) SELECT `token_id`, `permission_code` FROM `api_token_permissions`;--> statement-breakpoint
DROP TABLE `api_token_permissions`;--> statement-breakpoint
ALTER TABLE `__new_api_token_permissions` RENAME TO `api_token_permissions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
DROP INDEX IF EXISTS `integration_token_permissions_code_index`;--> statement-breakpoint
DROP INDEX IF EXISTS `integration_tokens_token_hmac_unique`;--> statement-breakpoint
DROP INDEX IF EXISTS `integration_tokens_user_id_index`;--> statement-breakpoint
DROP INDEX IF EXISTS `integration_tokens_expires_at_index`;--> statement-breakpoint
DROP INDEX IF EXISTS `integration_tokens_active_index`;--> statement-breakpoint
DROP INDEX IF EXISTS `integration_tokens_unrevoked_name_expiry_index`;--> statement-breakpoint
DROP INDEX IF EXISTS `integration_tokens_created_at_id_index`;--> statement-breakpoint
CREATE UNIQUE INDEX `api_tokens_token_hmac_unique` ON `api_tokens` (`token_hmac`);--> statement-breakpoint
CREATE INDEX `api_tokens_user_id_index` ON `api_tokens` (`user_id`);--> statement-breakpoint
CREATE INDEX `api_tokens_expires_at_index` ON `api_tokens` (`expires_at`);--> statement-breakpoint
CREATE INDEX `api_tokens_active_index` ON `api_tokens` (`revoked_at`,`expires_at`);--> statement-breakpoint
CREATE INDEX `api_tokens_unrevoked_name_expiry_index` ON `api_tokens` (`name`,`expires_at`) WHERE "api_tokens"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX `api_tokens_created_at_id_index` ON `api_tokens` ("created_at" desc,"id" desc);--> statement-breakpoint
CREATE INDEX `api_token_permissions_code_index` ON `api_token_permissions` (`permission_code`);--> statement-breakpoint
CREATE TRIGGER `api_tokens_delete_guard`
BEFORE DELETE ON `api_tokens`
BEGIN
  SELECT RAISE(ABORT, 'API tokens are append-only');
END;--> statement-breakpoint
CREATE TRIGGER `api_tokens_immutable_guard`
BEFORE UPDATE ON `api_tokens`
WHEN new.`id` <> old.`id`
  OR new.`user_id` <> old.`user_id`
  OR new.`name` <> old.`name`
  OR new.`token_hmac` <> old.`token_hmac`
  OR new.`created_at` <> old.`created_at`
  OR new.`expires_at` <> old.`expires_at`
  OR new.`rate_limit_per_minute` <> old.`rate_limit_per_minute`
  OR (old.`revoked_at` IS NOT NULL AND new.`revoked_at` IS NOT old.`revoked_at`)
  OR (old.`revoked_by_user_id` IS NOT NULL AND new.`revoked_by_user_id` IS NOT old.`revoked_by_user_id`)
BEGIN
  SELECT RAISE(ABORT, 'API token identity is immutable');
END;--> statement-breakpoint
CREATE TRIGGER `api_token_permissions_update_guard`
BEFORE UPDATE ON `api_token_permissions`
BEGIN
  SELECT RAISE(ABORT, 'API token permissions are immutable');
END;--> statement-breakpoint
CREATE TRIGGER `api_token_permissions_delete_guard`
BEFORE DELETE ON `api_token_permissions`
BEGIN
  SELECT RAISE(ABORT, 'API token permissions are immutable');
END;--> statement-breakpoint
CREATE TRIGGER `api_tokens_name_insert_guard`
BEFORE INSERT ON `api_tokens`
WHEN NEW.`name` <> trim(NEW.`name`)
BEGIN
  SELECT RAISE(ABORT, 'API token name must be trimmed');
END;--> statement-breakpoint
CREATE TRIGGER `api_tokens_active_name_insert_guard`
BEFORE INSERT ON `api_tokens`
WHEN EXISTS (
  SELECT 1 FROM `api_tokens`
  WHERE `name` = NEW.`name`
    AND `revoked_at` IS NULL
    AND `expires_at` > NEW.`created_at`
)
BEGIN
  SELECT RAISE(ABORT, 'API token active name conflict');
END;
