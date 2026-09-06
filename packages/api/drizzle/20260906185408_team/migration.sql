CREATE TABLE `team_invitations` (
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
	CONSTRAINT "team_invitation_profile_check" CHECK("profile" in ('collaborator', 'accountant'))
);
--> statement-breakpoint
CREATE TABLE `team_members` (
	`user_id` text PRIMARY KEY,
	`profile` text NOT NULL,
	`version` integer NOT NULL,
	CONSTRAINT `fk_team_members_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
	CONSTRAINT "team_member_profile_check" CHECK("profile" in ('collaborator', 'accountant')),
	CONSTRAINT "team_member_version_check" CHECK("version" > 0)
);
--> statement-breakpoint
CREATE INDEX `team_invitation_email_index` ON `team_invitations` (`email`);