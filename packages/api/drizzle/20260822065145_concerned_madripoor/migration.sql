CREATE TABLE `integration_token_permissions` (
	`token_id` text NOT NULL,
	`permission_code` text NOT NULL,
	CONSTRAINT `integration_token_permissions_pk` PRIMARY KEY(`token_id`, `permission_code`),
	CONSTRAINT `fk_integration_token_permissions_token_id_integration_tokens_id_fk` FOREIGN KEY (`token_id`) REFERENCES `integration_tokens`(`id`),
	CONSTRAINT `fk_integration_token_permissions_permission_code_permissions_code_fk` FOREIGN KEY (`permission_code`) REFERENCES `permissions`(`code`)
);
--> statement-breakpoint
CREATE TABLE `integration_tokens` (
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
	CONSTRAINT `fk_integration_tokens_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
	CONSTRAINT `fk_integration_tokens_revoked_by_user_id_users_id_fk` FOREIGN KEY (`revoked_by_user_id`) REFERENCES `users`(`id`),
	CONSTRAINT "integration_tokens_id_ulid_check" CHECK("id" is not null and length("id") = 26 and "id" not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr("id", 1, 1) between '0' and '7'),
	CONSTRAINT "integration_tokens_name_check" CHECK(length(trim("name")) between 1 and 120),
	CONSTRAINT "integration_tokens_token_hmac_check" CHECK(typeof("token_hmac") = 'blob' and length("token_hmac") = 32),
	CONSTRAINT "integration_tokens_expiry_check" CHECK("expires_at" > "created_at"),
	CONSTRAINT "integration_tokens_timestamps_check" CHECK(("last_used_at" is null or "last_used_at" >= "created_at") and ("revoked_at" is null or "revoked_at" >= "created_at")),
	CONSTRAINT "integration_tokens_revocation_check" CHECK(("revoked_at" is null and "revoked_by_user_id" is null) or ("revoked_at" is not null and "revoked_by_user_id" is not null)),
	CONSTRAINT "integration_tokens_rate_limit_check" CHECK("rate_limit_per_minute" between 1 and 600)
);
--> statement-breakpoint
CREATE INDEX `integration_token_permissions_code_index` ON `integration_token_permissions` (`permission_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `integration_tokens_name_unique` ON `integration_tokens` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `integration_tokens_token_hmac_unique` ON `integration_tokens` (`token_hmac`);--> statement-breakpoint
CREATE INDEX `integration_tokens_user_id_index` ON `integration_tokens` (`user_id`);--> statement-breakpoint
CREATE INDEX `integration_tokens_expires_at_index` ON `integration_tokens` (`expires_at`);--> statement-breakpoint
CREATE INDEX `integration_tokens_active_index` ON `integration_tokens` (`revoked_at`,`expires_at`);
--> statement-breakpoint
INSERT OR IGNORE INTO permissions (code) VALUES ('integration-token.manage');
--> statement-breakpoint
INSERT OR IGNORE INTO role_permissions (role_id, permission_code)
SELECT id, 'integration-token.manage' FROM roles WHERE name = 'administrator';
--> statement-breakpoint
CREATE TRIGGER integration_tokens_delete_guard
BEFORE DELETE ON integration_tokens
BEGIN
  SELECT RAISE(ABORT, 'integration tokens are append-only');
END;
--> statement-breakpoint
CREATE TRIGGER integration_tokens_immutable_guard
BEFORE UPDATE ON integration_tokens
WHEN new.id <> old.id
  OR new.user_id <> old.user_id
  OR new.name <> old.name
  OR new.token_hmac <> old.token_hmac
  OR new.created_at <> old.created_at
  OR new.expires_at <> old.expires_at
  OR new.rate_limit_per_minute <> old.rate_limit_per_minute
  OR (old.revoked_at IS NOT NULL AND new.revoked_at IS NOT old.revoked_at)
  OR (old.revoked_by_user_id IS NOT NULL AND new.revoked_by_user_id IS NOT old.revoked_by_user_id)
BEGIN
  SELECT RAISE(ABORT, 'integration token identity is immutable');
END;
--> statement-breakpoint
CREATE TRIGGER integration_token_permissions_update_guard
BEFORE UPDATE ON integration_token_permissions
BEGIN
  SELECT RAISE(ABORT, 'integration token permissions are immutable');
END;
--> statement-breakpoint
CREATE TRIGGER integration_token_permissions_delete_guard
BEFORE DELETE ON integration_token_permissions
BEGIN
  SELECT RAISE(ABORT, 'integration token permissions are immutable');
END;
