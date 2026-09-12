CREATE TABLE `accounting_tax_filing_settings` (
	`id` integer PRIMARY KEY,
	`adapter` text DEFAULT 'local' NOT NULL,
	`endpoint` text,
	`encrypted_api_key` text,
	`encryption_iv` text,
	`encryption_tag` text,
	`updated_at` integer,
	CONSTRAINT "accounting_tax_filing_settings_singleton_check" CHECK("id" = 1),
	CONSTRAINT "accounting_tax_filing_settings_adapter_check" CHECK("adapter" in ('local','http')),
	CONSTRAINT "accounting_tax_filing_settings_encryption_check" CHECK(("encrypted_api_key" is null and "encryption_iv" is null and "encryption_tag" is null) or ("encrypted_api_key" is not null and "encryption_iv" is not null and "encryption_tag" is not null))
);
--> statement-breakpoint
CREATE TABLE `accounting_tax_filings` (
	`id` text PRIMARY KEY,
	`request_id` text NOT NULL UNIQUE,
	`adapter` text NOT NULL,
	`starts_on` text NOT NULL,
	`ends_on` text NOT NULL,
	`payload_sha256` text NOT NULL,
	`provider_receipt` text NOT NULL,
	`submitted_at` integer NOT NULL,
	`submitted_by_user_id` text NOT NULL,
	CONSTRAINT `fk_accounting_tax_filings_submitted_by_user_id_users_id_fk` FOREIGN KEY (`submitted_by_user_id`) REFERENCES `users`(`id`),
	CONSTRAINT "accounting_tax_filings_adapter_check" CHECK("adapter" in ('local','http'))
);
--> statement-breakpoint
INSERT INTO `accounting_tax_filing_settings` (`id`, `adapter`) VALUES (1, 'local');
--> statement-breakpoint
CREATE TRIGGER `accounting_tax_filings_immutable_update` BEFORE UPDATE ON `accounting_tax_filings` BEGIN SELECT RAISE(ABORT, 'database.trigger.accounting_tax_filings_immutable_update'); END;
--> statement-breakpoint
CREATE TRIGGER `accounting_tax_filings_immutable_delete` BEFORE DELETE ON `accounting_tax_filings` BEGIN SELECT RAISE(ABORT, 'database.trigger.accounting_tax_filings_immutable_delete'); END;
