CREATE TABLE `checkout_events` (
	`event_id` text PRIMARY KEY,
	`request_id` text NOT NULL,
	`event_type` text NOT NULL,
	`received_at` integer NOT NULL,
	CONSTRAINT `fk_checkout_events_request_id_checkout_operations_request_id_fk` FOREIGN KEY (`request_id`) REFERENCES `checkout_operations`(`request_id`)
);
--> statement-breakpoint
CREATE TABLE `checkout_operations` (
	`request_id` text PRIMARY KEY,
	`request` text NOT NULL,
	`invoice_id` text NOT NULL,
	`revision_id` text NOT NULL,
	`invoice_number` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`created_by_user_id` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`return_url` text NOT NULL,
	`account_key` text,
	`status` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`lease` integer DEFAULT 0 NOT NULL,
	`next_attempt_at` integer,
	`session_id` text UNIQUE,
	`checkout_url` text,
	`error` text,
	CONSTRAINT `fk_checkout_operations_invoice_id_invoices_id_fk` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`),
	CONSTRAINT `fk_checkout_operations_revision_id_invoice_revisions_id_fk` FOREIGN KEY (`revision_id`) REFERENCES `invoice_revisions`(`id`),
	CONSTRAINT `fk_checkout_operations_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`),
	CONSTRAINT "checkout_status_check" CHECK("status" in ('queued','creating','retrying','open','paid','expired','failed','blocked')),
	CONSTRAINT "checkout_attempts_check" CHECK("attempts" between 0 and 5),
	CONSTRAINT "checkout_amount_check" CHECK("amount_cents" between 50 and 99999999)
);
--> statement-breakpoint
CREATE INDEX `checkout_due_index` ON `checkout_operations` (`next_attempt_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `checkout_active_invoice_unique` ON `checkout_operations` (`invoice_id`) WHERE "checkout_operations"."status" in ('queued','creating','retrying','open');
--> statement-breakpoint
CREATE TRIGGER checkout_request_immutable BEFORE UPDATE OF request_id, request, invoice_id, revision_id, invoice_number, amount_cents, created_by_user_id, created_at, expires_at, return_url, account_key ON checkout_operations
BEGIN SELECT RAISE(ABORT, 'checkout_immutable'); END;
--> statement-breakpoint
CREATE TRIGGER checkout_no_delete BEFORE DELETE ON checkout_operations
BEGIN SELECT RAISE(ABORT, 'checkout_immutable'); END;
--> statement-breakpoint
CREATE TRIGGER checkout_event_immutable BEFORE UPDATE ON checkout_events
BEGIN SELECT RAISE(ABORT, 'checkout_event_immutable'); END;
--> statement-breakpoint
CREATE TRIGGER checkout_event_no_delete BEFORE DELETE ON checkout_events
BEGIN SELECT RAISE(ABORT, 'checkout_event_immutable'); END;
