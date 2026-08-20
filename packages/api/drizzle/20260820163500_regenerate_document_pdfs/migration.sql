DROP TRIGGER IF EXISTS `document_artifacts_immutable_delete`;--> statement-breakpoint
DELETE FROM `document_artifacts`
WHERE `kind` = 'invoice-pdf'
   OR (`kind` = 'quote-pdf' AND NOT EXISTS (
     SELECT 1 FROM `quote_signatures`
     WHERE `quote_signatures`.`revision_id` = `document_artifacts`.`revision_id`
   ));--> statement-breakpoint
CREATE TRIGGER `document_artifacts_immutable_delete`
BEFORE DELETE ON `document_artifacts`
BEGIN
	SELECT RAISE(ABORT, 'document artifacts are immutable');
END;--> statement-breakpoint
UPDATE `invoice_pdf_jobs`
SET `status` = 'pending', `error` = NULL
WHERE `status` <> 'pending' OR `error` IS NOT NULL;
