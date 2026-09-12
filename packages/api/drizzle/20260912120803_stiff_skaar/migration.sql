PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_team_invitations` (
	`id` text PRIMARY KEY,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`profile` text NOT NULL,
	`token_hash` text NOT NULL UNIQUE,
	`created_by_user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`cancelled_at` integer,
	`accepted_at` integer,
	CONSTRAINT `fk_team_invitations_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`),
	CONSTRAINT "team_invitation_profile_check" CHECK("profile" in ('collaborator', 'accountant') or (length("profile") = 33 and substr("profile", 1, 7) = 'custom:' and substr("profile", 8, 1) between '0' and '7' and substr("profile", 8) not glob '*[^0-9A-HJKMNP-TV-Z]*'))
);
--> statement-breakpoint
INSERT INTO `__new_team_invitations`(`id`, `email`, `display_name`, `profile`, `token_hash`, `created_by_user_id`, `created_at`, `expires_at`, `cancelled_at`, `accepted_at`) SELECT `id`, `email`, `display_name`, `profile`, `token_hash`, `created_by_user_id`, `created_at`, `expires_at`, `cancelled_at`, `accepted_at` FROM `team_invitations`;--> statement-breakpoint
DROP TABLE `team_invitations`;--> statement-breakpoint
ALTER TABLE `__new_team_invitations` RENAME TO `team_invitations`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_team_members` (
	`user_id` text PRIMARY KEY,
	`profile` text NOT NULL,
	`version` integer NOT NULL,
	CONSTRAINT `fk_team_members_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
	CONSTRAINT "team_member_profile_check" CHECK("profile" in ('collaborator', 'accountant') or (length("profile") = 33 and substr("profile", 1, 7) = 'custom:' and substr("profile", 8, 1) between '0' and '7' and substr("profile", 8) not glob '*[^0-9A-HJKMNP-TV-Z]*')),
	CONSTRAINT "team_member_version_check" CHECK("version" > 0)
);
--> statement-breakpoint
INSERT INTO `__new_team_members`(`user_id`, `profile`, `version`) SELECT `user_id`, `profile`, `version` FROM `team_members`;--> statement-breakpoint
DROP TABLE `team_members`;--> statement-breakpoint
ALTER TABLE `__new_team_members` RENAME TO `team_members`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `team_invitation_email_index` ON `team_invitations` (`email`);
