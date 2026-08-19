CREATE TABLE `clients` (
	`id` text PRIMARY KEY,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`archived_at` integer,
	CONSTRAINT `fk_clients_id_users_id_fk` FOREIGN KEY (`id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
	CONSTRAINT "clients_id_ulid_check" CHECK("id" is not null and length("id") = 26 and "id" not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr("id", 1, 1) between '0' and '7'),
	CONSTRAINT "clients_timestamps_check" CHECK("updated_at" >= "created_at"),
	CONSTRAINT "clients_archived_at_check" CHECK("archived_at" is null or "archived_at" >= "created_at")
);--> statement-breakpoint
INSERT INTO `clients` (`id`, `created_at`, `updated_at`, `archived_at`)
	SELECT `id`, `created_at`, `updated_at`, `disabled_at` FROM `users` WHERE `kind` = 'client';--> statement-breakpoint
INSERT INTO `permissions` (`code`) VALUES ('client.access.create');--> statement-breakpoint
INSERT INTO `role_permissions` (`role_id`, `permission_code`)
	SELECT `id`, 'client.access.create' FROM `roles` WHERE `name` = 'administrator';
