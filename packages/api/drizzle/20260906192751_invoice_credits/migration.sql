CREATE TABLE `invoice_credit_notes` (
	`id` text PRIMARY KEY,
	`invoice_id` text NOT NULL UNIQUE,
	`invoice_revision_id` text NOT NULL,
	`request_id` text NOT NULL UNIQUE,
	`number` text NOT NULL UNIQUE,
	`reason` text NOT NULL,
	`issued_at` text NOT NULL,
	`issued_by_user_id` text NOT NULL,
	`net_total_cents` integer NOT NULL,
	`vat_total_cents` integer NOT NULL,
	`total_cents` integer NOT NULL,
	`expected_version` integer NOT NULL,
	CONSTRAINT `fk_invoice_credit_notes_invoice_id_invoices_id_fk` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`),
	CONSTRAINT `fk_invoice_credit_notes_invoice_revision_id_invoice_revisions_id_fk` FOREIGN KEY (`invoice_revision_id`) REFERENCES `invoice_revisions`(`id`),
	CONSTRAINT `fk_invoice_credit_notes_issued_by_user_id_users_id_fk` FOREIGN KEY (`issued_by_user_id`) REFERENCES `users`(`id`),
	CONSTRAINT "credit_note_amount_check" CHECK("total_cents" > 0 and "total_cents" = "net_total_cents" + "vat_total_cents")
);
--> statement-breakpoint
CREATE TABLE `invoice_refunds` (
	`id` text PRIMARY KEY,
	`invoice_id` text NOT NULL,
	`request_id` text NOT NULL UNIQUE,
	`amount_cents` integer NOT NULL,
	`refunded_on` text NOT NULL,
	`reference` text NOT NULL,
	`recorded_at` text NOT NULL,
	`recorded_by_user_id` text NOT NULL,
	`cancelled_at` text,
	`cancellation_reason` text,
	`cancelled_by_user_id` text,
	CONSTRAINT `fk_invoice_refunds_invoice_id_invoices_id_fk` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`),
	CONSTRAINT `fk_invoice_refunds_recorded_by_user_id_users_id_fk` FOREIGN KEY (`recorded_by_user_id`) REFERENCES `users`(`id`),
	CONSTRAINT `fk_invoice_refunds_cancelled_by_user_id_users_id_fk` FOREIGN KEY (`cancelled_by_user_id`) REFERENCES `users`(`id`),
	CONSTRAINT "invoice_refund_amount_check" CHECK("amount_cents" between 1 and 9007199254740991)
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_business_reference_counters` (
	`kind` text NOT NULL,
	`year` integer NOT NULL,
	`next_value` integer NOT NULL,
	CONSTRAINT `business_reference_counters_pk` PRIMARY KEY(`kind`, `year`),
	CONSTRAINT "business_reference_counters_kind_check" CHECK("kind" in ('quote', 'order', 'invoice', 'credit-note')),
	CONSTRAINT "business_reference_counters_year_check" CHECK("year" between 1 and 9999),
	CONSTRAINT "business_reference_counters_next_value_check" CHECK("next_value" between 1 and 1000000)
);
--> statement-breakpoint
INSERT INTO `__new_business_reference_counters`(`kind`, `year`, `next_value`) SELECT `kind`, `year`, `next_value` FROM `business_reference_counters`;--> statement-breakpoint
DROP TABLE `business_reference_counters`;--> statement-breakpoint
ALTER TABLE `__new_business_reference_counters` RENAME TO `business_reference_counters`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_document_artifacts` (
	`id` text PRIMARY KEY,
	`revision_id` text,
	`invoice_revision_id` text,
	`order_id` text,
	`kind` text NOT NULL,
	`content_type` text NOT NULL,
	`byte_size` integer NOT NULL,
	`sha256` text NOT NULL,
	`content` blob NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_document_artifacts_revision_id_quote_revisions_id_fk` FOREIGN KEY (`revision_id`) REFERENCES `quote_revisions`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_document_artifacts_invoice_revision_id_invoice_revisions_id_fk` FOREIGN KEY (`invoice_revision_id`) REFERENCES `invoice_revisions`(`id`),
	CONSTRAINT `fk_document_artifacts_order_id_orders_id_fk` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`),
	CONSTRAINT "document_artifacts_id_ulid_check" CHECK("id" is not null and length("id") = 26 and "id" not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr("id", 1, 1) between '0' and '7'),
	CONSTRAINT "document_artifacts_kind_check" CHECK(("kind" = 'quote-pdf' and "revision_id" is not null and "invoice_revision_id" is null and "order_id" is null) or ("kind" in ('invoice-pdf', 'credit-note-pdf') and "revision_id" is null and "invoice_revision_id" is not null and "order_id" is null) or ("kind" = 'order-pdf' and "revision_id" is null and "invoice_revision_id" is null and "order_id" is not null)),
	CONSTRAINT "document_artifacts_content_type_check" CHECK("content_type" = 'application/pdf'),
	CONSTRAINT "document_artifacts_content_check" CHECK("byte_size" > 0 and "byte_size" = length("content") and typeof("content") = 'blob' and length("sha256") = 64 and "sha256" not glob '*[^a-f0-9]*')
);
--> statement-breakpoint
INSERT INTO `__new_document_artifacts`(`id`, `revision_id`, `invoice_revision_id`, `order_id`, `kind`, `content_type`, `byte_size`, `sha256`, `content`, `created_at`) SELECT `id`, `revision_id`, `invoice_revision_id`, `order_id`, `kind`, `content_type`, `byte_size`, `sha256`, `content`, `created_at` FROM `document_artifacts`;--> statement-breakpoint
PRAGMA legacy_alter_table=ON;--> statement-breakpoint
DROP TABLE `document_artifacts`;--> statement-breakpoint
ALTER TABLE `__new_document_artifacts` RENAME TO `document_artifacts`;--> statement-breakpoint
PRAGMA legacy_alter_table=OFF;--> statement-breakpoint
CREATE TRIGGER document_artifacts_immutable_delete BEFORE DELETE ON document_artifacts BEGIN SELECT RAISE(ABORT, 'database.trigger.document_artifacts_immutable_delete'); END;--> statement-breakpoint
CREATE TRIGGER document_artifacts_immutable_update BEFORE UPDATE ON document_artifacts BEGIN SELECT RAISE(ABORT, 'database.trigger.document_artifacts_immutable_update'); END;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `document_artifacts_quote_revision_kind_unique` ON `document_artifacts` (`revision_id`,`kind`);--> statement-breakpoint
CREATE UNIQUE INDEX `document_artifacts_invoice_revision_kind_unique` ON `document_artifacts` (`invoice_revision_id`,`kind`);--> statement-breakpoint
CREATE UNIQUE INDEX `document_artifacts_order_kind_unique` ON `document_artifacts` (`order_id`,`kind`);--> statement-breakpoint
CREATE INDEX `document_artifacts_revision_id_index` ON `document_artifacts` (`revision_id`);--> statement-breakpoint
CREATE INDEX `document_artifacts_invoice_revision_id_index` ON `document_artifacts` (`invoice_revision_id`);--> statement-breakpoint
CREATE INDEX `document_artifacts_order_id_index` ON `document_artifacts` (`order_id`);--> statement-breakpoint
CREATE INDEX `invoice_refund_invoice_index` ON `invoice_refunds` (`invoice_id`);--> statement-breakpoint
INSERT INTO permissions (code) VALUES ('invoice.credit'), ('invoice.refund');--> statement-breakpoint
INSERT INTO role_permissions (role_id, permission_code) SELECT id, 'invoice.credit' FROM roles WHERE name = 'administrator';--> statement-breakpoint
INSERT INTO role_permissions (role_id, permission_code) SELECT id, 'invoice.refund' FROM roles WHERE name = 'administrator';--> statement-breakpoint
CREATE TRIGGER invoice_credit_notes_no_update BEFORE UPDATE ON invoice_credit_notes BEGIN SELECT RAISE(ABORT, 'database.trigger.credit_note_immutable'); END;--> statement-breakpoint
CREATE TRIGGER invoice_credit_notes_no_delete BEFORE DELETE ON invoice_credit_notes BEGIN SELECT RAISE(ABORT, 'database.trigger.credit_note_immutable'); END;--> statement-breakpoint
CREATE TRIGGER invoice_refunds_no_delete BEFORE DELETE ON invoice_refunds BEGIN SELECT RAISE(ABORT, 'database.trigger.refund_immutable'); END;--> statement-breakpoint
CREATE TRIGGER invoice_refunds_immutable_fields BEFORE UPDATE ON invoice_refunds WHEN NEW.id IS NOT OLD.id OR NEW.invoice_id IS NOT OLD.invoice_id OR NEW.request_id IS NOT OLD.request_id OR NEW.amount_cents IS NOT OLD.amount_cents OR NEW.refunded_on IS NOT OLD.refunded_on OR NEW.reference IS NOT OLD.reference OR NEW.recorded_at IS NOT OLD.recorded_at OR NEW.recorded_by_user_id IS NOT OLD.recorded_by_user_id OR OLD.cancelled_at IS NOT NULL BEGIN SELECT RAISE(ABORT, 'database.trigger.refund_immutable'); END;
