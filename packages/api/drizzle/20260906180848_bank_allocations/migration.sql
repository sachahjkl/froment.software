PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_bank_matches` (
	`id` text PRIMARY KEY,
	`request_id` text NOT NULL UNIQUE,
	`amount_cents` integer NOT NULL,
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
	CONSTRAINT `fk_bank_matches_cancelled_by_user_id_users_id_fk` FOREIGN KEY (`cancelled_by_user_id`) REFERENCES `users`(`id`),
	CONSTRAINT "bank_match_amount_check" CHECK("amount_cents" between 1 and 9007199254740991)
);
--> statement-breakpoint
INSERT INTO `__new_bank_matches`(`id`, `request_id`, `amount_cents`, `transaction_id`, `payment_id`, `matched_at`, `matched_by_user_id`, `cancelled_at`, `cancelled_by_user_id`, `cancellation_reason`) SELECT m.`id`, m.`id`, p.`amount_cents`, m.`transaction_id`, m.`payment_id`, m.`matched_at`, m.`matched_by_user_id`, m.`cancelled_at`, m.`cancelled_by_user_id`, m.`cancellation_reason` FROM `bank_matches` m JOIN `invoice_payments` p ON p.`id` = m.`payment_id`;--> statement-breakpoint
DROP TABLE `bank_matches`;--> statement-breakpoint
ALTER TABLE `__new_bank_matches` RENAME TO `bank_matches`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `bank_match_transaction_index` ON `bank_matches` (`transaction_id`) WHERE "bank_matches"."cancelled_at" is null;--> statement-breakpoint
CREATE INDEX `bank_match_payment_index` ON `bank_matches` (`payment_id`) WHERE "bank_matches"."cancelled_at" is null;
