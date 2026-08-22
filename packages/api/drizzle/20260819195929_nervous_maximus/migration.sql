UPDATE `users`
SET `disabled_at` = COALESCE(`disabled_at`, (SELECT `archived_at` FROM `clients` WHERE `clients`.`id` = `users`.`id`)),
	`updated_at` = MAX(`updated_at`, COALESCE((SELECT `archived_at` FROM `clients` WHERE `clients`.`id` = `users`.`id`), `updated_at`))
WHERE `kind` = 'client';--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
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
PRAGMA foreign_keys=ON;
