ALTER TABLE `invoice_credit_allocations` ADD `cancelled_at` text;--> statement-breakpoint
ALTER TABLE `invoice_credit_allocations` ADD `cancelled_by_user_id` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `invoice_credit_allocations` ADD `cancellation_reason` text;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_invoice_credit_allocations` (
	`id` text PRIMARY KEY,
	`request_id` text NOT NULL UNIQUE,
	`source_invoice_id` text NOT NULL,
	`target_invoice_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`allocated_on` text NOT NULL,
	`reference` text NOT NULL,
	`recorded_at` text NOT NULL,
	`recorded_by_user_id` text NOT NULL,
	`cancelled_at` text,
	`cancelled_by_user_id` text,
	`cancellation_reason` text,
	CONSTRAINT `fk_invoice_credit_allocations_source_invoice_id_invoices_id_fk` FOREIGN KEY (`source_invoice_id`) REFERENCES `invoices`(`id`),
	CONSTRAINT `fk_invoice_credit_allocations_target_invoice_id_invoices_id_fk` FOREIGN KEY (`target_invoice_id`) REFERENCES `invoices`(`id`),
	CONSTRAINT `fk_invoice_credit_allocations_recorded_by_user_id_users_id_fk` FOREIGN KEY (`recorded_by_user_id`) REFERENCES `users`(`id`),
	CONSTRAINT `fk_invoice_credit_allocations_cancelled_by_user_id_users_id_fk` FOREIGN KEY (`cancelled_by_user_id`) REFERENCES `users`(`id`),
	CONSTRAINT "invoice_credit_allocations_amount_check" CHECK("amount_cents" > 0),
	CONSTRAINT "invoice_credit_allocations_distinct_invoices_check" CHECK("source_invoice_id" <> "target_invoice_id"),
	CONSTRAINT "invoice_credit_allocations_cancellation_check" CHECK(("cancelled_at" is null and "cancelled_by_user_id" is null and "cancellation_reason" is null) or ("cancelled_at" is not null and "cancelled_by_user_id" is not null and "cancellation_reason" is not null and length(trim("cancellation_reason")) between 1 and 500))
);
--> statement-breakpoint
INSERT INTO `__new_invoice_credit_allocations`(`id`, `request_id`, `source_invoice_id`, `target_invoice_id`, `amount_cents`, `allocated_on`, `reference`, `recorded_at`, `recorded_by_user_id`) SELECT `id`, `request_id`, `source_invoice_id`, `target_invoice_id`, `amount_cents`, `allocated_on`, `reference`, `recorded_at`, `recorded_by_user_id` FROM `invoice_credit_allocations`;--> statement-breakpoint
DROP TABLE `invoice_credit_allocations`;--> statement-breakpoint
ALTER TABLE `__new_invoice_credit_allocations` RENAME TO `invoice_credit_allocations`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `invoice_credit_allocations_source_index` ON `invoice_credit_allocations` (`source_invoice_id`);--> statement-breakpoint
CREATE INDEX `invoice_credit_allocations_target_index` ON `invoice_credit_allocations` (`target_invoice_id`);
--> statement-breakpoint
CREATE TRIGGER `invoice_credit_allocations_immutable_update` BEFORE UPDATE ON `invoice_credit_allocations`
WHEN NEW.`id` IS NOT OLD.`id`
  OR NEW.`request_id` IS NOT OLD.`request_id`
  OR NEW.`source_invoice_id` IS NOT OLD.`source_invoice_id`
  OR NEW.`target_invoice_id` IS NOT OLD.`target_invoice_id`
  OR NEW.`amount_cents` IS NOT OLD.`amount_cents`
  OR NEW.`allocated_on` IS NOT OLD.`allocated_on`
  OR NEW.`reference` IS NOT OLD.`reference`
  OR NEW.`recorded_at` IS NOT OLD.`recorded_at`
  OR NEW.`recorded_by_user_id` IS NOT OLD.`recorded_by_user_id`
  OR OLD.`cancelled_at` IS NOT NULL
  OR NEW.`cancelled_at` IS NULL
  OR NEW.`cancelled_by_user_id` IS NULL
  OR NEW.`cancellation_reason` IS NULL
BEGIN SELECT RAISE(ABORT, 'database.trigger.invoice_credit_allocations_immutable_update'); END;
--> statement-breakpoint
CREATE TRIGGER `invoice_credit_allocations_immutable_delete` BEFORE DELETE ON `invoice_credit_allocations`
BEGIN SELECT RAISE(ABORT, 'database.trigger.invoice_credit_allocations_immutable_delete'); END;
