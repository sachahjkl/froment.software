CREATE TABLE `supplier_bank_matches` (
	`id` text PRIMARY KEY,
	`request_id` text NOT NULL UNIQUE,
	`transaction_id` text NOT NULL,
	`batch_id` text NOT NULL,
	`invoice_id` text NOT NULL,
	`amount_cents` integer NOT NULL,
	`matched_at` text NOT NULL,
	`matched_by_user_id` text NOT NULL,
	`cancelled_at` text,
	`cancelled_by_user_id` text,
	`cancellation_reason` text,
	CONSTRAINT `fk_supplier_bank_matches_transaction_id_bank_transactions_id_fk` FOREIGN KEY (`transaction_id`) REFERENCES `bank_transactions`(`id`),
	CONSTRAINT `fk_supplier_bank_matches_batch_id_supplier_payment_batches_id_fk` FOREIGN KEY (`batch_id`) REFERENCES `supplier_payment_batches`(`id`),
	CONSTRAINT `fk_supplier_bank_matches_invoice_id_supplier_invoices_id_fk` FOREIGN KEY (`invoice_id`) REFERENCES `supplier_invoices`(`id`),
	CONSTRAINT `fk_supplier_bank_matches_matched_by_user_id_users_id_fk` FOREIGN KEY (`matched_by_user_id`) REFERENCES `users`(`id`),
	CONSTRAINT `fk_supplier_bank_matches_cancelled_by_user_id_users_id_fk` FOREIGN KEY (`cancelled_by_user_id`) REFERENCES `users`(`id`),
	CONSTRAINT "supplier_bank_matches_amount_check" CHECK("amount_cents" > 0)
);
