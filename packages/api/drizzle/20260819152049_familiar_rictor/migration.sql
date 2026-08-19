CREATE TABLE `access_credentials` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`secret_hmac` blob NOT NULL,
	`created_at` integer NOT NULL,
	`last_used_at` integer,
	`revoked_at` integer,
	CONSTRAINT `fk_access_credentials_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
	CONSTRAINT "access_credentials_secret_hmac_check" CHECK(typeof("secret_hmac") = 'blob' and length("secret_hmac") = 32),
	CONSTRAINT "access_credentials_id_ulid_check" CHECK("id" is not null and length("id") = 26 and "id" not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr("id", 1, 1) between '0' and '7'),
	CONSTRAINT "access_credentials_timestamps_check" CHECK(("last_used_at" is null or "last_used_at" >= "created_at") and ("revoked_at" is null or "revoked_at" >= "created_at"))
);
--> statement-breakpoint
CREATE TABLE `permissions` (
	`code` text PRIMARY KEY,
	CONSTRAINT "permissions_code_check" CHECK("code" is not null and length(trim("code")) > 0)
);
--> statement-breakpoint
CREATE TABLE `role_permissions` (
	`role_id` text NOT NULL,
	`permission_code` text NOT NULL,
	CONSTRAINT `role_permissions_pk` PRIMARY KEY(`role_id`, `permission_code`),
	CONSTRAINT `fk_role_permissions_role_id_roles_id_fk` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_role_permissions_permission_code_permissions_code_fk` FOREIGN KEY (`permission_code`) REFERENCES `permissions`(`code`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL UNIQUE,
	`created_at` integer NOT NULL,
	CONSTRAINT "roles_id_ulid_check" CHECK("id" is not null and length("id") = 26 and "id" not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr("id", 1, 1) between '0' and '7'),
	CONSTRAINT "roles_name_check" CHECK(length(trim("name")) > 0)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`token_hmac` blob NOT NULL,
	`csrf_hmac` blob NOT NULL,
	`created_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL,
	`idle_expires_at` integer NOT NULL,
	`absolute_expires_at` integer NOT NULL,
	`revoked_at` integer,
	CONSTRAINT `fk_sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
	CONSTRAINT "sessions_id_ulid_check" CHECK("id" is not null and length("id") = 26 and "id" not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr("id", 1, 1) between '0' and '7'),
	CONSTRAINT "sessions_token_hmac_check" CHECK(typeof("token_hmac") = 'blob' and length("token_hmac") = 32),
	CONSTRAINT "sessions_csrf_hmac_check" CHECK(typeof("csrf_hmac") = 'blob' and length("csrf_hmac") = 32),
	CONSTRAINT "sessions_timestamps_check" CHECK("last_seen_at" >= "created_at" and "idle_expires_at" > "created_at" and "absolute_expires_at" >= "idle_expires_at" and ("revoked_at" is null or "revoked_at" >= "created_at"))
);
--> statement-breakpoint
CREATE TABLE `user_roles` (
	`user_id` text NOT NULL,
	`role_id` text NOT NULL,
	CONSTRAINT `user_roles_pk` PRIMARY KEY(`user_id`, `role_id`),
	CONSTRAINT `fk_user_roles_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_user_roles_role_id_roles_id_fk` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY,
	`display_name` text NOT NULL,
	`kind` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`disabled_at` integer,
	CONSTRAINT "users_id_ulid_check" CHECK("id" is not null and length("id") = 26 and "id" not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr("id", 1, 1) between '0' and '7'),
	CONSTRAINT "users_kind_check" CHECK("kind" in ('administrator', 'client')),
	CONSTRAINT "users_display_name_check" CHECK(length(trim("display_name")) > 0),
	CONSTRAINT "users_timestamps_check" CHECK("updated_at" >= "created_at"),
	CONSTRAINT "users_disabled_at_check" CHECK("disabled_at" is null or "disabled_at" >= "created_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `access_credentials_secret_hmac_unique` ON `access_credentials` (`secret_hmac`);--> statement-breakpoint
CREATE INDEX `access_credentials_user_id_index` ON `access_credentials` (`user_id`);--> statement-breakpoint
CREATE INDEX `role_permissions_permission_code_index` ON `role_permissions` (`permission_code`);--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_hmac_unique` ON `sessions` (`token_hmac`);--> statement-breakpoint
CREATE INDEX `sessions_user_id_index` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_idle_expiry_index` ON `sessions` (`idle_expires_at`);--> statement-breakpoint
CREATE INDEX `sessions_absolute_expiry_index` ON `sessions` (`absolute_expires_at`);--> statement-breakpoint
CREATE INDEX `user_roles_role_id_index` ON `user_roles` (`role_id`);
