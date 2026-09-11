CREATE TABLE `email_reminder_rejections` (
	`request_id` text PRIMARY KEY,
	`request` text NOT NULL,
	`reason` text NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT `fk_email_reminder_rejections_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`),
	CONSTRAINT "email_reminder_rejections_request_check" CHECK(json_valid("request")),
	CONSTRAINT "email_reminder_rejections_reason_check" CHECK("reason" in ('invoice-ineligible', 'invoice-changed', 'recipient-invalid', 'mode-changed', 'date-invalid', 'already-scheduled', 'limit'))
);
