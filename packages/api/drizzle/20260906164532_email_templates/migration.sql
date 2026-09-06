CREATE TABLE `email_templates` (
	`id` text PRIMARY KEY,
	`content` text NOT NULL,
	`version` integer NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`updated_at` text NOT NULL,
	`updated_by_user_id` text NOT NULL,
	CONSTRAINT `fk_email_templates_updated_by_user_id_users_id_fk` FOREIGN KEY (`updated_by_user_id`) REFERENCES `users`(`id`),
	CONSTRAINT "email_templates_version_check" CHECK("version" > 0),
	CONSTRAINT "email_templates_content_check" CHECK(json_valid("content"))
);
--> statement-breakpoint
INSERT INTO permissions (code) VALUES ('email.template.manage');
--> statement-breakpoint
INSERT INTO role_permissions (role_id, permission_code)
SELECT id, 'email.template.manage' FROM roles WHERE name = 'administrator';
