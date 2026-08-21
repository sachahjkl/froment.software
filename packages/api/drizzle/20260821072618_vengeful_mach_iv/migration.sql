DROP TRIGGER IF EXISTS `document_artifacts_immutable_update`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `document_artifacts_immutable_delete`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `published_quote_revisions_immutable_update`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `published_quote_revisions_immutable_delete`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `published_quote_lines_immutable_insert`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `published_quote_lines_immutable_update`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `published_quote_lines_immutable_delete`;--> statement-breakpoint
DROP TRIGGER IF EXISTS `published_invoice_lines_immutable_insert`;--> statement-breakpoint
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
	CONSTRAINT `document_artifacts_id_ulid_check` CHECK(`id` is not null and length(`id`) = 26 and `id` not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr(`id`, 1, 1) between '0' and '7'),
	CONSTRAINT `document_artifacts_kind_check` CHECK((`kind` = 'quote-pdf' and `revision_id` is not null and `invoice_revision_id` is null and `order_id` is null) or (`kind` = 'invoice-pdf' and `revision_id` is null and `invoice_revision_id` is not null and `order_id` is null) or (`kind` = 'order-pdf' and `revision_id` is null and `invoice_revision_id` is null and `order_id` is not null)),
	CONSTRAINT `document_artifacts_content_type_check` CHECK(`content_type` = 'application/pdf'),
	CONSTRAINT `document_artifacts_content_check` CHECK(`byte_size` > 0 and `byte_size` = length(`content`) and typeof(`content`) = 'blob' and length(`sha256`) = 64 and `sha256` not glob '*[^a-f0-9]*')
);--> statement-breakpoint
INSERT INTO `__new_document_artifacts` (`id`, `revision_id`, `invoice_revision_id`, `order_id`, `kind`, `content_type`, `byte_size`, `sha256`, `content`, `created_at`)
SELECT `id`, `revision_id`, `invoice_revision_id`, NULL, `kind`, `content_type`, `byte_size`, `sha256`, `content`, `created_at` FROM `document_artifacts`;--> statement-breakpoint
DROP TABLE `document_artifacts`;--> statement-breakpoint
ALTER TABLE `__new_document_artifacts` RENAME TO `document_artifacts`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `document_artifacts_quote_revision_kind_unique` ON `document_artifacts` (`revision_id`,`kind`);--> statement-breakpoint
CREATE UNIQUE INDEX `document_artifacts_invoice_revision_kind_unique` ON `document_artifacts` (`invoice_revision_id`,`kind`);--> statement-breakpoint
CREATE UNIQUE INDEX `document_artifacts_order_kind_unique` ON `document_artifacts` (`order_id`,`kind`);--> statement-breakpoint
CREATE INDEX `document_artifacts_revision_id_index` ON `document_artifacts` (`revision_id`);--> statement-breakpoint
CREATE INDEX `document_artifacts_invoice_revision_id_index` ON `document_artifacts` (`invoice_revision_id`);--> statement-breakpoint
CREATE INDEX `document_artifacts_order_id_index` ON `document_artifacts` (`order_id`);--> statement-breakpoint
CREATE TRIGGER `document_artifacts_immutable_update` BEFORE UPDATE ON `document_artifacts` BEGIN SELECT RAISE(ABORT, 'document artifacts are immutable'); END;--> statement-breakpoint
CREATE TRIGGER `document_artifacts_immutable_delete` BEFORE DELETE ON `document_artifacts` BEGIN SELECT RAISE(ABORT, 'document artifacts are immutable'); END;--> statement-breakpoint
CREATE TRIGGER `published_quote_revisions_immutable_update` BEFORE UPDATE ON `quote_revisions` WHEN EXISTS (SELECT 1 FROM `document_artifacts` WHERE `revision_id` = OLD.`id`) BEGIN SELECT RAISE(ABORT, 'published quote revisions are immutable'); END;--> statement-breakpoint
CREATE TRIGGER `published_quote_revisions_immutable_delete` BEFORE DELETE ON `quote_revisions` WHEN EXISTS (SELECT 1 FROM `document_artifacts` WHERE `revision_id` = OLD.`id`) BEGIN SELECT RAISE(ABORT, 'published quote revisions are immutable'); END;--> statement-breakpoint
CREATE TRIGGER `published_quote_lines_immutable_insert` BEFORE INSERT ON `quote_lines` WHEN EXISTS (SELECT 1 FROM `document_artifacts` WHERE `revision_id` = NEW.`revision_id`) BEGIN SELECT RAISE(ABORT, 'published quote lines are immutable'); END;--> statement-breakpoint
CREATE TRIGGER `published_quote_lines_immutable_update` BEFORE UPDATE ON `quote_lines` WHEN EXISTS (SELECT 1 FROM `document_artifacts` WHERE `revision_id` = OLD.`revision_id`) BEGIN SELECT RAISE(ABORT, 'published quote lines are immutable'); END;--> statement-breakpoint
CREATE TRIGGER `published_quote_lines_immutable_delete` BEFORE DELETE ON `quote_lines` WHEN EXISTS (SELECT 1 FROM `document_artifacts` WHERE `revision_id` = OLD.`revision_id`) BEGIN SELECT RAISE(ABORT, 'published quote lines are immutable'); END;--> statement-breakpoint
CREATE TRIGGER `published_invoice_lines_immutable_insert` BEFORE INSERT ON `invoice_lines` WHEN EXISTS (SELECT 1 FROM `document_artifacts` WHERE `invoice_revision_id` = NEW.`revision_id`) BEGIN SELECT RAISE(ABORT, 'published invoice lines are immutable'); END;
