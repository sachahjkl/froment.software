CREATE TABLE `passkey_challenges` (
	`id` text PRIMARY KEY,
	`challenge` text NOT NULL,
	`kind` text NOT NULL,
	`user_id` text,
	`session_id` text,
	`name` text,
	`expires_at` integer NOT NULL,
	CONSTRAINT `fk_passkey_challenges_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `passkeys` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`credential_id` text NOT NULL UNIQUE,
	`public_key` blob NOT NULL,
	`counter` integer NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_used_at` integer,
	CONSTRAINT `fk_passkeys_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
	CONSTRAINT "passkeys_counter_check" CHECK("counter" >= 0)
);
--> statement-breakpoint
CREATE INDEX `passkey_challenges_expiry_index` ON `passkey_challenges` (`expires_at`);--> statement-breakpoint
CREATE INDEX `passkeys_user_index` ON `passkeys` (`user_id`);