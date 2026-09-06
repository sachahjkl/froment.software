CREATE TABLE `email_reminders` (
	`id` text PRIMARY KEY,
	`invoice_id` text NOT NULL,
	`request` text NOT NULL,
	`send_at` text NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL,
	`reason` text,
	`operation_id` text,
	`prepared_version` integer,
	`prepared_paid_cents` integer,
	`prepared_recipient` text,
	`created_by_user_id` text NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT `fk_email_reminders_invoice_id_invoices_id_fk` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`),
	CONSTRAINT `fk_email_reminders_operation_id_integration_operations_id_fk` FOREIGN KEY (`operation_id`) REFERENCES `integration_operations`(`id`),
	CONSTRAINT `fk_email_reminders_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`),
	CONSTRAINT "email_reminders_request_check" CHECK(json_valid("request")),
	CONSTRAINT "email_reminders_status_check" CHECK("status" in ('scheduled', 'cancelled', 'skipped', 'queued'))
);
--> statement-breakpoint
CREATE INDEX `email_reminders_due_index` ON `email_reminders` (`status`,`send_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `email_reminders_invoice_pending_index` ON `email_reminders` (`invoice_id`) WHERE "email_reminders"."status" = 'scheduled';
--> statement-breakpoint
INSERT INTO permissions (code) VALUES ('email.reminder.manage');
--> statement-breakpoint
INSERT INTO role_permissions (role_id, permission_code)
SELECT id, 'email.reminder.manage' FROM roles WHERE name = 'administrator';
