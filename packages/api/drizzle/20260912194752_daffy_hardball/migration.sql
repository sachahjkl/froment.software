CREATE TABLE `invoice_credit_allocations` (
	`id` text PRIMARY KEY,
	`request_id` text NOT NULL UNIQUE,
	`source_invoice_id` text NOT NULL,
	`target_invoice_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`allocated_on` text NOT NULL,
	`reference` text NOT NULL,
	`recorded_at` text NOT NULL,
	`recorded_by_user_id` text NOT NULL,
	CONSTRAINT `fk_invoice_credit_allocations_source_invoice_id_invoices_id_fk` FOREIGN KEY (`source_invoice_id`) REFERENCES `invoices`(`id`),
	CONSTRAINT `fk_invoice_credit_allocations_target_invoice_id_invoices_id_fk` FOREIGN KEY (`target_invoice_id`) REFERENCES `invoices`(`id`),
	CONSTRAINT `fk_invoice_credit_allocations_recorded_by_user_id_users_id_fk` FOREIGN KEY (`recorded_by_user_id`) REFERENCES `users`(`id`),
	CONSTRAINT "invoice_credit_allocations_amount_check" CHECK("amount_cents" > 0),
	CONSTRAINT "invoice_credit_allocations_distinct_invoices_check" CHECK("source_invoice_id" <> "target_invoice_id")
);
--> statement-breakpoint
CREATE INDEX `invoice_credit_allocations_source_index` ON `invoice_credit_allocations` (`source_invoice_id`);--> statement-breakpoint
CREATE INDEX `invoice_credit_allocations_target_index` ON `invoice_credit_allocations` (`target_invoice_id`);
--> statement-breakpoint
CREATE TRIGGER `invoice_credit_allocations_immutable_update` BEFORE UPDATE ON `invoice_credit_allocations` BEGIN SELECT RAISE(ABORT, 'database.trigger.invoice_credit_allocations_immutable_update'); END;
--> statement-breakpoint
CREATE TRIGGER `invoice_credit_allocations_immutable_delete` BEFORE DELETE ON `invoice_credit_allocations` BEGIN SELECT RAISE(ABORT, 'database.trigger.invoice_credit_allocations_immutable_delete'); END;
