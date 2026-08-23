CREATE TABLE `client_access_accounts` (
	`user_id` text PRIMARY KEY,
	`client_id` text NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_client_access_accounts_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_client_access_accounts_client_id_clients_id_fk` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `client_access_accounts_client_id_index` ON `client_access_accounts` (`client_id`);
--> statement-breakpoint
INSERT INTO `client_access_accounts` (`user_id`, `client_id`, `created_at`)
SELECT `clients`.`id`, `clients`.`id`, `password_credentials`.`created_at`
FROM `clients`
JOIN `password_credentials` ON `password_credentials`.`user_id` = `clients`.`id`;
--> statement-breakpoint
INSERT INTO `permissions` (`code`) VALUES ('client.access.manage');
--> statement-breakpoint
INSERT INTO `role_permissions` (`role_id`, `permission_code`)
SELECT `role_id`, 'client.access.manage'
FROM `role_permissions`
WHERE `permission_code` = 'client.access.create';
--> statement-breakpoint
DELETE FROM `role_permissions` WHERE `permission_code` = 'client.access.create';
--> statement-breakpoint
DELETE FROM `permissions` WHERE `code` = 'client.access.create';
--> statement-breakpoint
CREATE TRIGGER `client_access_accounts_cleanup_before_client_delete`
BEFORE DELETE ON `clients`
BEGIN
	DELETE FROM `users`
	WHERE `id` IN (
		SELECT `user_id`
		FROM `client_access_accounts`
		WHERE `client_id` = OLD.`id` AND `user_id` <> OLD.`id`
	);
END;
