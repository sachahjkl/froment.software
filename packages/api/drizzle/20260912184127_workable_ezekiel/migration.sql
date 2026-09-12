DROP TRIGGER `bank_transactions_immutable_update`;--> statement-breakpoint
ALTER TABLE `bank_matches` ADD `exchange_difference_functional_cents` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `bank_transactions` ADD `currency` text DEFAULT 'EUR' NOT NULL;--> statement-breakpoint
ALTER TABLE `bank_transactions` ADD `functional_currency` text DEFAULT 'EUR' NOT NULL;--> statement-breakpoint
ALTER TABLE `bank_transactions` ADD `exchange_rate_date` text DEFAULT '1970-01-01' NOT NULL;--> statement-breakpoint
ALTER TABLE `bank_transactions` ADD `foreign_units_per_functional_unit_nanos` integer DEFAULT 1000000000 NOT NULL;--> statement-breakpoint
ALTER TABLE `bank_transactions` ADD `functional_amount_cents` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE `bank_transactions`
SET `exchange_rate_date` = `booked_on`,
    `functional_amount_cents` = `amount_cents`;
--> statement-breakpoint
CREATE TRIGGER `bank_transactions_immutable_update` BEFORE UPDATE ON `bank_transactions`
BEGIN SELECT RAISE(ABORT, 'database.trigger.bank_transactions_immutable'); END;
