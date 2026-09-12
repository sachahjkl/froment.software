CREATE TABLE `custom_roles` (
	`id` text PRIMARY KEY,
	`request_id` text NOT NULL UNIQUE,
	`name` text NOT NULL UNIQUE,
	`permissions` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "custom_roles_id_ulid_check" CHECK("id" is not null and length("id") = 26 and "id" not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr("id", 1, 1) between '0' and '7'),
	CONSTRAINT "custom_roles_request_id_check" CHECK(length("request_id") = 36),
	CONSTRAINT "custom_roles_name_check" CHECK(length(trim("name")) between 1 and 80),
	CONSTRAINT "custom_roles_permissions_check" CHECK(json_valid("permissions")),
	CONSTRAINT "custom_roles_version_check" CHECK("version" > 0),
	CONSTRAINT "custom_roles_timestamps_check" CHECK("updated_at" >= "created_at")
);
--> statement-breakpoint
INSERT INTO `permissions` (`code`) VALUES ('role.read'), ('role.manage');
--> statement-breakpoint
INSERT OR IGNORE INTO `role_permissions` (`role_id`, `permission_code`)
SELECT `roles`.`id`, `permissions`.`code`
FROM `roles` CROSS JOIN `permissions`
WHERE `roles`.`name` = 'administrator' AND `permissions`.`code` LIKE 'role.%';
--> statement-breakpoint
INSERT OR IGNORE INTO `role_permissions` (`role_id`, `permission_code`)
SELECT `user_roles`.`role_id`, 'role.read'
FROM `team_members`
JOIN `user_roles` ON `user_roles`.`user_id` = `team_members`.`user_id`;
