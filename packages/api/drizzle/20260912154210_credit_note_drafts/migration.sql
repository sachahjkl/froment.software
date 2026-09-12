PRAGMA foreign_keys=OFF;
--> statement-breakpoint
DROP TABLE `invoice_credit_notes`;
--> statement-breakpoint
CREATE TABLE `invoice_credit_notes` (
	`id` text PRIMARY KEY,
	`client_id` text NOT NULL,
	`request_id` text NOT NULL UNIQUE,
	`issue_request_id` text UNIQUE,
	`status` text NOT NULL,
	`version` integer NOT NULL,
	`number` text UNIQUE,
	`reason` text NOT NULL,
	`currency` text NOT NULL,
	`created_at` text NOT NULL,
	`created_by_user_id` text NOT NULL,
	`issued_at` text,
	`issued_by_user_id` text,
	`net_total_cents` integer NOT NULL,
	`vat_total_cents` integer NOT NULL,
	`total_cents` integer NOT NULL,
	CONSTRAINT `fk_invoice_credit_notes_client_id_clients_id_fk` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`),
	CONSTRAINT `fk_invoice_credit_notes_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`),
	CONSTRAINT `fk_invoice_credit_notes_issued_by_user_id_users_id_fk` FOREIGN KEY (`issued_by_user_id`) REFERENCES `users`(`id`),
	CONSTRAINT "credit_note_status_check" CHECK("status" in ('draft', 'issued')),
	CONSTRAINT "credit_note_version_check" CHECK("version" >= 1),
	CONSTRAINT "credit_note_amount_check" CHECK("total_cents" > 0 and "total_cents" = "net_total_cents" + "vat_total_cents"),
	CONSTRAINT "credit_note_state_check" CHECK(("status" = 'draft' and "number" is null and "issue_request_id" is null and "issued_at" is null and "issued_by_user_id" is null) or ("status" = 'issued' and "number" is not null and "issue_request_id" is not null and "issued_at" is not null and "issued_by_user_id" is not null))
);
--> statement-breakpoint
CREATE TABLE `invoice_credit_note_revisions` (
	`id` text PRIMARY KEY,
	`credit_note_id` text NOT NULL,
	`version` integer NOT NULL,
	`reason` text NOT NULL,
	`created_at` text NOT NULL,
	`created_by_user_id` text NOT NULL,
	`net_total_cents` integer NOT NULL,
	`vat_total_cents` integer NOT NULL,
	`total_cents` integer NOT NULL,
	CONSTRAINT `fk_invoice_credit_note_revisions_credit_note_id_invoice_credit_notes_id_fk` FOREIGN KEY (`credit_note_id`) REFERENCES `invoice_credit_notes`(`id`),
	CONSTRAINT `fk_invoice_credit_note_revisions_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`),
	CONSTRAINT "credit_note_revision_version_check" CHECK("version" >= 1),
	CONSTRAINT "credit_note_revision_amount_check" CHECK("total_cents" > 0 and "total_cents" = "net_total_cents" + "vat_total_cents")
);
--> statement-breakpoint
CREATE TABLE `invoice_credit_note_lines` (
	`id` text PRIMARY KEY,
	`credit_note_id` text NOT NULL,
	`credit_note_revision_id` text NOT NULL,
	`invoice_id` text NOT NULL,
	`invoice_revision_id` text NOT NULL,
	`invoice_version` integer NOT NULL,
	`invoice_number` text NOT NULL,
	`source_line_id` text NOT NULL,
	`position` integer NOT NULL,
	`description` text NOT NULL,
	`quantity_milli` integer NOT NULL,
	`unit_price_cents` integer NOT NULL,
	`vat_rate_basis_points` integer NOT NULL,
	`net_total_cents` integer NOT NULL,
	`vat_total_cents` integer NOT NULL,
	`total_cents` integer NOT NULL,
	CONSTRAINT `fk_invoice_credit_note_lines_credit_note_id_invoice_credit_notes_id_fk` FOREIGN KEY (`credit_note_id`) REFERENCES `invoice_credit_notes`(`id`),
	CONSTRAINT `fk_invoice_credit_note_lines_credit_note_revision_id_invoice_credit_note_revisions_id_fk` FOREIGN KEY (`credit_note_revision_id`) REFERENCES `invoice_credit_note_revisions`(`id`),
	CONSTRAINT `fk_invoice_credit_note_lines_invoice_id_invoices_id_fk` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`),
	CONSTRAINT `fk_invoice_credit_note_lines_invoice_revision_id_invoice_revisions_id_fk` FOREIGN KEY (`invoice_revision_id`) REFERENCES `invoice_revisions`(`id`),
	CONSTRAINT "credit_note_line_invoice_version_check" CHECK("invoice_version" >= 1),
	CONSTRAINT "credit_note_line_position_check" CHECK("position" >= 0),
	CONSTRAINT "credit_note_line_quantity_check" CHECK("quantity_milli" > 0),
	CONSTRAINT "credit_note_line_amount_check" CHECK("total_cents" = "net_total_cents" + "vat_total_cents")
);
--> statement-breakpoint
CREATE TABLE `invoice_credit_note_artifacts` (
	`credit_note_id` text PRIMARY KEY,
	`content` blob NOT NULL,
	`byte_size` integer NOT NULL,
	`sha256` text NOT NULL,
	`created_at` text NOT NULL,
	CONSTRAINT `fk_invoice_credit_note_artifacts_credit_note_id_invoice_credit_notes_id_fk` FOREIGN KEY (`credit_note_id`) REFERENCES `invoice_credit_notes`(`id`),
	CONSTRAINT "credit_note_artifact_content_check" CHECK("byte_size" > 0 and "byte_size" = length("content") and typeof("content") = 'blob' and length("sha256") = 64 and "sha256" not glob '*[^a-f0-9]*')
);
--> statement-breakpoint
CREATE INDEX `credit_note_client_index` ON `invoice_credit_notes` (`client_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `credit_note_revision_version_unique` ON `invoice_credit_note_revisions` (`credit_note_id`,`version`);
--> statement-breakpoint
CREATE UNIQUE INDEX `credit_note_line_position_unique` ON `invoice_credit_note_lines` (`credit_note_revision_id`,`position`);
--> statement-breakpoint
CREATE INDEX `credit_note_line_source_index` ON `invoice_credit_note_lines` (`invoice_id`,`source_line_id`);
--> statement-breakpoint
CREATE TRIGGER invoice_credit_notes_issued_update BEFORE UPDATE ON invoice_credit_notes
WHEN OLD.status = 'issued'
BEGIN SELECT RAISE(ABORT, 'database.trigger.credit_note_immutable'); END;
--> statement-breakpoint
CREATE TRIGGER invoice_credit_notes_delete BEFORE DELETE ON invoice_credit_notes
BEGIN SELECT RAISE(ABORT, 'database.trigger.credit_note_immutable'); END;
--> statement-breakpoint
CREATE TRIGGER invoice_credit_note_revisions_update BEFORE UPDATE ON invoice_credit_note_revisions
BEGIN SELECT RAISE(ABORT, 'database.trigger.invoice_credit_note_revisions_update'); END;
--> statement-breakpoint
CREATE TRIGGER invoice_credit_note_revisions_delete BEFORE DELETE ON invoice_credit_note_revisions
BEGIN SELECT RAISE(ABORT, 'database.trigger.invoice_credit_note_revisions_delete'); END;
--> statement-breakpoint
CREATE TRIGGER invoice_credit_note_lines_update BEFORE UPDATE ON invoice_credit_note_lines
BEGIN SELECT RAISE(ABORT, 'database.trigger.invoice_credit_note_lines_update'); END;
--> statement-breakpoint
CREATE TRIGGER invoice_credit_note_lines_delete BEFORE DELETE ON invoice_credit_note_lines
BEGIN SELECT RAISE(ABORT, 'database.trigger.invoice_credit_note_lines_delete'); END;
--> statement-breakpoint
CREATE TRIGGER invoice_credit_note_artifacts_insert BEFORE INSERT ON invoice_credit_note_artifacts
WHEN (SELECT status FROM invoice_credit_notes WHERE id = NEW.credit_note_id) <> 'issued'
BEGIN SELECT RAISE(ABORT, 'database.trigger.invoice_credit_note_artifacts_insert'); END;
--> statement-breakpoint
CREATE TRIGGER invoice_credit_note_artifacts_update BEFORE UPDATE ON invoice_credit_note_artifacts
BEGIN SELECT RAISE(ABORT, 'database.trigger.invoice_credit_note_artifacts_update'); END;
--> statement-breakpoint
CREATE TRIGGER invoice_credit_note_artifacts_delete BEFORE DELETE ON invoice_credit_note_artifacts
BEGIN SELECT RAISE(ABORT, 'database.trigger.invoice_credit_note_artifacts_delete'); END;
--> statement-breakpoint
PRAGMA foreign_keys=ON;
