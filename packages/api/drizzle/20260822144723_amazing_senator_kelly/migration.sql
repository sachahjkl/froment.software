CREATE TABLE `password_credentials` (
	`user_id` text PRIMARY KEY,
	`email` text NOT NULL UNIQUE,
	`password_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`password_changed_at` integer NOT NULL,
	CONSTRAINT `fk_password_credentials_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
	CONSTRAINT "password_credentials_email_check" CHECK("email" = lower(trim("email")) and length("email") between 3 and 254),
	CONSTRAINT "password_credentials_password_hash_check" CHECK("password_hash" glob '$argon2id$*'),
	CONSTRAINT "password_credentials_timestamps_check" CHECK("updated_at" >= "created_at" and "password_changed_at" between "created_at" and "updated_at")
);
