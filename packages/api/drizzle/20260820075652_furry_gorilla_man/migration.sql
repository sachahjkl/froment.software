CREATE TABLE `quote_condition_presets` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`conditions` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	CONSTRAINT "quote_condition_presets_id_ulid_check" CHECK("id" is not null and length("id") = 26 and "id" not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr("id", 1, 1) between '0' and '7'),
	CONSTRAINT "quote_condition_presets_name_check" CHECK(length(trim("name")) between 1 and 120),
	CONSTRAINT "quote_condition_presets_conditions_check" CHECK(length(trim("conditions")) > 0 and length("conditions") <= 2000),
	CONSTRAINT "quote_condition_presets_timestamps_check" CHECK("updated_at" >= "created_at")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quote_condition_presets_name_unique` ON `quote_condition_presets` (`name`);