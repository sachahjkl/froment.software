CREATE TABLE `invoice_payments` (
	`id` text PRIMARY KEY,
	`invoice_id` text NOT NULL,
	`request_id` text NOT NULL UNIQUE,
	`expected_version` integer NOT NULL,
	`amount_cents` integer NOT NULL,
	`paid_on` text NOT NULL,
	`method` text NOT NULL,
	`reference` text NOT NULL,
	`recorded_at` text NOT NULL,
	`recorded_by_user_id` text NOT NULL,
	CONSTRAINT `fk_invoice_payments_invoice_id_invoices_id_fk` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`),
	CONSTRAINT `fk_invoice_payments_recorded_by_user_id_users_id_fk` FOREIGN KEY (`recorded_by_user_id`) REFERENCES `users`(`id`),
	CONSTRAINT "invoice_payments_amount_check" CHECK("amount_cents" between 1 and 9007199254740991),
	CONSTRAINT "invoice_payments_method_check" CHECK("method" in ('transfer', 'card', 'cash', 'cheque', 'other')),
	CONSTRAINT "invoice_payments_reference_check" CHECK(length(trim("reference")) between 1 and 160)
);
--> statement-breakpoint
CREATE INDEX `invoice_payments_invoice_index` ON `invoice_payments` (`invoice_id`);