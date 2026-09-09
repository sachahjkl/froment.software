CREATE TABLE `email_tests` (
	`account_key` text,
	`request_id` text PRIMARY KEY,
	`request` text NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`status` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` integer,
	`provider_id` text,
	`error` text,
	CONSTRAINT `fk_email_tests_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`),
	CONSTRAINT "email_test_status_check" CHECK("status" in ('queued', 'sending', 'retrying', 'accepted', 'delivered', 'bounced', 'complained', 'failed', 'blocked')),
	CONSTRAINT "email_test_attempts_check" CHECK("attempts" between 0 and 5)
);
--> statement-breakpoint
INSERT INTO permissions (code) VALUES ('integration.configure');
--> statement-breakpoint
INSERT INTO role_permissions (role_id, permission_code) SELECT id, 'integration.configure' FROM roles WHERE name = 'administrator';
--> statement-breakpoint
CREATE TRIGGER email_test_request_immutable BEFORE UPDATE ON email_tests
WHEN OLD.request_id <> NEW.request_id OR OLD.request <> NEW.request OR OLD.created_by_user_id <> NEW.created_by_user_id OR OLD.created_at <> NEW.created_at OR OLD.account_key IS NOT NEW.account_key
BEGIN SELECT RAISE(ABORT, 'database.trigger.email_test_immutable'); END;
--> statement-breakpoint
CREATE TRIGGER email_test_no_delete BEFORE DELETE ON email_tests
BEGIN SELECT RAISE(ABORT, 'database.trigger.email_test_immutable'); END;
