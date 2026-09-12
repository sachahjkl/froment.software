CREATE TABLE `supplier_invoice_evidence` (
	`id` text PRIMARY KEY,
	`invoice_id` text NOT NULL,
	`file_name` text NOT NULL,
	`media_type` text NOT NULL,
	`size` integer NOT NULL,
	`sha256` text NOT NULL,
	`content` blob NOT NULL,
	`created_at` integer NOT NULL,
	`created_by_user_id` text NOT NULL,
	CONSTRAINT `fk_supplier_invoice_evidence_invoice_id_supplier_invoices_id_fk` FOREIGN KEY (`invoice_id`) REFERENCES `supplier_invoices`(`id`),
	CONSTRAINT `fk_supplier_invoice_evidence_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`),
	CONSTRAINT "supplier_invoice_evidence_size_check" CHECK("size" > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `supplier_invoice_evidence_sha_unique` ON `supplier_invoice_evidence` (`invoice_id`,`sha256`);
--> statement-breakpoint
CREATE TRIGGER `supplier_invoice_evidence_immutable_update` BEFORE UPDATE ON `supplier_invoice_evidence` BEGIN SELECT RAISE(ABORT, 'database.trigger.supplier_invoice_evidence_immutable_update'); END;
--> statement-breakpoint
CREATE TRIGGER `supplier_invoice_evidence_immutable_delete` BEFORE DELETE ON `supplier_invoice_evidence` BEGIN SELECT RAISE(ABORT, 'database.trigger.supplier_invoice_evidence_immutable_delete'); END;
