ALTER TABLE `accounting_entries` ADD `source_type` text;--> statement-breakpoint
ALTER TABLE `accounting_entries` ADD `source_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `accounting_entries_source_unique` ON `accounting_entries` (`source_type`,`source_id`);