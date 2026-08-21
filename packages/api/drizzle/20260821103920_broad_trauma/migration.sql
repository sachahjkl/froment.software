PRAGMA foreign_keys=OFF;--> statement-breakpoint
DROP TRIGGER IF EXISTS `orders_business_relation_insert`;--> statement-breakpoint
CREATE TABLE `__new_quotes` (
	`id` text PRIMARY KEY,
	`reference` text NOT NULL,
	`client_id` text NOT NULL,
	`status` text NOT NULL,
	`version` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT `fk_quotes_client_id_clients_id_fk` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`),
	CONSTRAINT "quotes_reference_check" CHECK("reference" glob 'DE-[0-9][0-9][0-9][0-9]-[0-9][0-9][0-9][0-9][0-9][0-9]'),
	CONSTRAINT "quotes_id_ulid_check" CHECK("id" is not null and length("id") = 26 and "id" not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr("id", 1, 1) between '0' and '7'),
	CONSTRAINT "quotes_status_check" CHECK("status" in ('draft', 'sent', 'accepted', 'rejected', 'expired', 'cancelled')),
	CONSTRAINT "quotes_version_check" CHECK("version" >= 1),
	CONSTRAINT "quotes_timestamps_check" CHECK("updated_at" >= "created_at")
);
--> statement-breakpoint
INSERT INTO `__new_quotes`(`id`, `reference`, `client_id`, `status`, `version`, `created_at`, `updated_at`) SELECT `id`, `reference`, `client_id`, `status`, `version`, `created_at`, `updated_at` FROM `quotes`;--> statement-breakpoint
DROP TABLE `quotes`;--> statement-breakpoint
ALTER TABLE `__new_quotes` RENAME TO `quotes`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `quotes_client_id_index` ON `quotes` (`client_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `quotes_reference_unique` ON `quotes` (`reference`);
--> statement-breakpoint
CREATE TRIGGER `quotes_business_relation_update` BEFORE UPDATE OF `client_id` ON `quotes` WHEN EXISTS (SELECT 1 FROM `orders` WHERE `quote_id` = OLD.`id` AND `client_id` <> NEW.`client_id`) BEGIN SELECT RAISE(ABORT, 'quote business relationship violation'); END;
--> statement-breakpoint
CREATE TRIGGER `orders_business_relation_insert` BEFORE INSERT ON `orders` WHEN NOT EXISTS (SELECT 1 FROM `quotes` WHERE `id` = NEW.`quote_id` AND `client_id` = NEW.`client_id`) OR NOT EXISTS (SELECT 1 FROM `quote_revisions` WHERE `id` = NEW.`revision_id` AND `quote_id` = NEW.`quote_id`) OR NOT EXISTS (SELECT 1 FROM `quote_signatures` WHERE `id` = NEW.`signature_id` AND `quote_id` = NEW.`quote_id` AND `revision_id` = NEW.`revision_id`) BEGIN SELECT RAISE(ABORT, 'order business relationship violation'); END;
