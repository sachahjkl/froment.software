CREATE TABLE `email_drafts` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`content` text NOT NULL,
	`version` integer NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `fk_email_drafts_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
	CONSTRAINT "email_drafts_version_check" CHECK("version" > 0),
	CONSTRAINT "email_drafts_content_check" CHECK(json_valid("content"))
);
--> statement-breakpoint
CREATE INDEX `email_drafts_user_index` ON `email_drafts` (`user_id`,`archived`);
--> statement-breakpoint
INSERT INTO permissions (code) VALUES ('email.draft.manage');
--> statement-breakpoint
INSERT INTO role_permissions (role_id, permission_code)
SELECT id, 'email.draft.manage' FROM roles WHERE name = 'administrator';
