CREATE TABLE `exchange_rates` (
	`id` text PRIMARY KEY,
	`rate_date` text NOT NULL,
	`functional_currency` text NOT NULL,
	`foreign_currency` text NOT NULL,
	`foreign_units_per_functional_unit_nanos` integer NOT NULL,
	`source` text NOT NULL,
	`imported_at` integer NOT NULL,
	`created_by_user_id` text,
	CONSTRAINT `fk_exchange_rates_created_by_user_id_users_id_fk` FOREIGN KEY (`created_by_user_id`) REFERENCES `users`(`id`),
	CONSTRAINT "exchange_rate_currency_check" CHECK("functional_currency" <> "foreign_currency"),
	CONSTRAINT "exchange_rate_value_check" CHECK("foreign_units_per_functional_unit_nanos" > 0),
	CONSTRAINT "exchange_rate_source_check" CHECK("source" in ('ecb', 'manual'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `exchange_rate_date_currency_unique` ON `exchange_rates` (`rate_date`,`functional_currency`,`foreign_currency`);--> statement-breakpoint
CREATE INDEX `exchange_rate_date_index` ON `exchange_rates` (`rate_date`);