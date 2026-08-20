CREATE TABLE `invoice_pdf_jobs` (
	`invoice_revision_id` text PRIMARY KEY,
	`invoice_id` text NOT NULL,
	`invoice_number` text NOT NULL,
	`version` integer NOT NULL,
	`actor_user_id` text NOT NULL,
	`status` text NOT NULL,
	`attempts` integer NOT NULL,
	`error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_invoice_pdf_jobs_invoice_revision_id_invoice_revisions_id_fk` FOREIGN KEY (`invoice_revision_id`) REFERENCES `invoice_revisions`(`id`),
	CONSTRAINT `fk_invoice_pdf_jobs_invoice_id_invoices_id_fk` FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`),
	CONSTRAINT `fk_invoice_pdf_jobs_actor_user_id_users_id_fk` FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`),
	CONSTRAINT "invoice_pdf_jobs_revision_id_ulid_check" CHECK("invoice_revision_id" is not null and length("invoice_revision_id") = 26 and "invoice_revision_id" not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr("invoice_revision_id", 1, 1) between '0' and '7'),
	CONSTRAINT "invoice_pdf_jobs_invoice_id_ulid_check" CHECK("invoice_id" is not null and length("invoice_id") = 26 and "invoice_id" not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr("invoice_id", 1, 1) between '0' and '7'),
	CONSTRAINT "invoice_pdf_jobs_actor_id_ulid_check" CHECK("actor_user_id" is not null and length("actor_user_id") = 26 and "actor_user_id" not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr("actor_user_id", 1, 1) between '0' and '7'),
	CONSTRAINT "invoice_pdf_jobs_number_check" CHECK("invoice_number" glob 'F-[0-9]*'),
	CONSTRAINT "invoice_pdf_jobs_version_check" CHECK("version" >= 1),
	CONSTRAINT "invoice_pdf_jobs_status_check" CHECK("status" in ('pending', 'processing', 'ready', 'failed')),
	CONSTRAINT "invoice_pdf_jobs_attempts_check" CHECK("attempts" >= 0),
	CONSTRAINT "invoice_pdf_jobs_error_check" CHECK(("status" = 'failed' and "error" = 'pdf.render_failed') or ("status" <> 'failed' and "error" is null)),
	CONSTRAINT "invoice_pdf_jobs_timestamps_check" CHECK("updated_at" >= "created_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoice_pdf_jobs_invoice_id_unique` ON `invoice_pdf_jobs` (`invoice_id`);--> statement-breakpoint
CREATE INDEX `invoice_pdf_jobs_status_updated_at_index` ON `invoice_pdf_jobs` (`status`,`updated_at`);--> statement-breakpoint
INSERT INTO `invoice_pdf_jobs`
  (`invoice_revision_id`, `invoice_id`, `invoice_number`, `version`, `actor_user_id`,
   `status`, `attempts`, `error`, `created_at`, `updated_at`)
SELECT invoice_revisions.id, invoices.id, invoices.invoice_number, invoices.version,
       invoice_revisions.created_by_user_id,
       CASE WHEN document_artifacts.id IS NULL THEN 'pending' ELSE 'ready' END,
       CASE WHEN document_artifacts.id IS NULL THEN 0 ELSE 1 END,
       NULL, invoices.issued_at, invoices.updated_at
FROM invoices
JOIN invoice_revisions
  ON invoice_revisions.invoice_id = invoices.id
 AND invoice_revisions.version = invoices.version
LEFT JOIN document_artifacts
  ON document_artifacts.invoice_revision_id = invoice_revisions.id
 AND document_artifacts.kind = 'invoice-pdf'
WHERE invoices.status IN ('issued', 'paid', 'void');
