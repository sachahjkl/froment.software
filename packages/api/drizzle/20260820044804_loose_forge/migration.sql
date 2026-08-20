CREATE TABLE `document_artifacts` (
	`id` text PRIMARY KEY,
	`revision_id` text NOT NULL,
	`kind` text NOT NULL,
	`content_type` text NOT NULL,
	`byte_size` integer NOT NULL,
	`sha256` text NOT NULL,
	`content` blob NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_document_artifacts_revision_id_quote_revisions_id_fk` FOREIGN KEY (`revision_id`) REFERENCES `quote_revisions`(`id`) ON DELETE CASCADE,
	CONSTRAINT "document_artifacts_id_ulid_check" CHECK("id" is not null and length("id") = 26 and "id" not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr("id", 1, 1) between '0' and '7'),
	CONSTRAINT "document_artifacts_kind_check" CHECK("kind" = 'quote-pdf'),
	CONSTRAINT "document_artifacts_content_type_check" CHECK("content_type" = 'application/pdf'),
	CONSTRAINT "document_artifacts_content_check" CHECK("byte_size" > 0 and "byte_size" = length("content") and typeof("content") = 'blob' and length("sha256") = 64 and "sha256" not glob '*[^a-f0-9]*')
);
--> statement-breakpoint
CREATE UNIQUE INDEX `document_artifacts_revision_kind_unique` ON `document_artifacts` (`revision_id`,`kind`);--> statement-breakpoint
CREATE INDEX `document_artifacts_revision_id_index` ON `document_artifacts` (`revision_id`);