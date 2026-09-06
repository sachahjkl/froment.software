CREATE TABLE `bank_matches` (
	`id` text PRIMARY KEY,
	`transaction_id` text NOT NULL,
	`payment_id` text NOT NULL,
	`matched_at` text NOT NULL,
	`matched_by_user_id` text NOT NULL,
	`cancelled_at` text,
	`cancelled_by_user_id` text,
	`cancellation_reason` text,
	CONSTRAINT `fk_bank_matches_transaction_id_bank_transactions_id_fk` FOREIGN KEY (`transaction_id`) REFERENCES `bank_transactions`(`id`),
	CONSTRAINT `fk_bank_matches_payment_id_invoice_payments_id_fk` FOREIGN KEY (`payment_id`) REFERENCES `invoice_payments`(`id`),
	CONSTRAINT `fk_bank_matches_matched_by_user_id_users_id_fk` FOREIGN KEY (`matched_by_user_id`) REFERENCES `users`(`id`),
	CONSTRAINT `fk_bank_matches_cancelled_by_user_id_users_id_fk` FOREIGN KEY (`cancelled_by_user_id`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE TABLE `bank_transactions` (
	`id` text PRIMARY KEY,
	`account` text NOT NULL,
	`reference` text NOT NULL,
	`booked_on` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`description` text NOT NULL,
	`imported_at` text NOT NULL,
	`imported_by_user_id` text NOT NULL,
	CONSTRAINT `fk_bank_transactions_imported_by_user_id_users_id_fk` FOREIGN KEY (`imported_by_user_id`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `bank_match_transaction_index` ON `bank_matches` (`transaction_id`) WHERE "bank_matches"."cancelled_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX `bank_match_payment_index` ON `bank_matches` (`payment_id`) WHERE "bank_matches"."cancelled_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX `bank_transaction_source_index` ON `bank_transactions` (`account`,`reference`);