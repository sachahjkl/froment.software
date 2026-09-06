ALTER TABLE `invoice_payments` ADD `cancelled_at` text;--> statement-breakpoint
ALTER TABLE `invoice_payments` ADD `cancelled_by_user_id` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `invoice_payments` ADD `cancellation_reason` text;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_invoice_payments` (
	`id` text PRIMARY KEY,
	`invoice_id` text NOT NULL,
	`request_id` text NOT NULL UNIQUE,
	`expected_version` integer NOT NULL,
	`amount_cents` integer NOT NULL,
	`paid_on` text NOT NULL,
	`method` text NOT NULL,
	`reference` text NOT NULL,
	`recorded_at` text NOT NULL,
	`cancelled_at` text,
	`cancelled_by_user_id` text,
	`cancellation_reason` text,
	`recorded_by_user_id` text NOT NULL,
	CONSTRAINT `fk_invoice_payments_invoice_id_invoices_id_fk` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`),
	CONSTRAINT `fk_invoice_payments_cancelled_by_user_id_users_id_fk` FOREIGN KEY (`cancelled_by_user_id`) REFERENCES `users`(`id`),
	CONSTRAINT `fk_invoice_payments_recorded_by_user_id_users_id_fk` FOREIGN KEY (`recorded_by_user_id`) REFERENCES `users`(`id`),
	CONSTRAINT "invoice_payments_cancellation_check" CHECK(("cancelled_at" is null and "cancelled_by_user_id" is null and "cancellation_reason" is null) or ("cancelled_at" is not null and "cancelled_by_user_id" is not null and "cancellation_reason" is not null and length(trim("cancellation_reason")) between 1 and 500)),
	CONSTRAINT "invoice_payments_amount_check" CHECK("amount_cents" between 1 and 9007199254740991),
	CONSTRAINT "invoice_payments_method_check" CHECK("method" in ('transfer', 'card', 'cash', 'cheque', 'other')),
	CONSTRAINT "invoice_payments_reference_check" CHECK(length(trim("reference")) between 1 and 160)
);
--> statement-breakpoint
INSERT INTO `__new_invoice_payments`(`id`, `invoice_id`, `request_id`, `expected_version`, `amount_cents`, `paid_on`, `method`, `reference`, `recorded_at`, `recorded_by_user_id`) SELECT `id`, `invoice_id`, `request_id`, `expected_version`, `amount_cents`, `paid_on`, `method`, `reference`, `recorded_at`, `recorded_by_user_id` FROM `invoice_payments`;--> statement-breakpoint
DROP TABLE `invoice_payments`;--> statement-breakpoint
ALTER TABLE `__new_invoice_payments` RENAME TO `invoice_payments`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `invoice_payments_invoice_index` ON `invoice_payments` (`invoice_id`);