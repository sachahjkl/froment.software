CREATE TABLE `orders` (
	`id` text PRIMARY KEY,
	`quote_id` text NOT NULL,
	`revision_id` text NOT NULL,
	`client_id` text NOT NULL,
	`signature_id` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_orders_quote_id_quotes_id_fk` FOREIGN KEY (`quote_id`) REFERENCES `quotes`(`id`),
	CONSTRAINT `fk_orders_revision_id_quote_revisions_id_fk` FOREIGN KEY (`revision_id`) REFERENCES `quote_revisions`(`id`),
	CONSTRAINT `fk_orders_client_id_clients_id_fk` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`),
	CONSTRAINT `fk_orders_signature_id_quote_signatures_id_fk` FOREIGN KEY (`signature_id`) REFERENCES `quote_signatures`(`id`),
	CONSTRAINT "orders_id_ulid_check" CHECK("id" is not null and length("id") = 26 and "id" not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr("id", 1, 1) between '0' and '7'),
	CONSTRAINT "orders_status_check" CHECK("status" = 'confirmed')
);
--> statement-breakpoint
CREATE TABLE `quote_signatures` (
	`id` text PRIMARY KEY,
	`quote_id` text NOT NULL,
	`revision_id` text NOT NULL,
	`link_id` text NOT NULL,
	`signer_name` text NOT NULL,
	`consent` integer NOT NULL,
	`signature_kind` text NOT NULL,
	`signature_value` text NOT NULL,
	`signed_at` integer NOT NULL,
	`ip_address` text NOT NULL,
	`user_agent` text NOT NULL,
	`snapshot_sha256` text NOT NULL,
	`pdf_sha256` text NOT NULL,
	`audit_event_id` text NOT NULL,
	`evidence_content` blob NOT NULL,
	`evidence_sha256` text NOT NULL,
	CONSTRAINT `fk_quote_signatures_quote_id_quotes_id_fk` FOREIGN KEY (`quote_id`) REFERENCES `quotes`(`id`),
	CONSTRAINT `fk_quote_signatures_revision_id_quote_revisions_id_fk` FOREIGN KEY (`revision_id`) REFERENCES `quote_revisions`(`id`),
	CONSTRAINT `fk_quote_signatures_link_id_quote_links_id_fk` FOREIGN KEY (`link_id`) REFERENCES `quote_links`(`id`),
	CONSTRAINT `fk_quote_signatures_audit_event_id_audit_events_id_fk` FOREIGN KEY (`audit_event_id`) REFERENCES `audit_events`(`id`),
	CONSTRAINT "quote_signatures_id_ulid_check" CHECK("id" is not null and length("id") = 26 and "id" not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr("id", 1, 1) between '0' and '7'),
	CONSTRAINT "quote_signatures_signer_check" CHECK(length(trim("signer_name")) between 1 and 160 and length(trim("signature_value")) between 1 and 160 and "signature_kind" = 'typed' and "consent" = 1),
	CONSTRAINT "quote_signatures_context_check" CHECK(length("ip_address") between 1 and 64 and length("user_agent") <= 512),
	CONSTRAINT "quote_signatures_hashes_check" CHECK(length("snapshot_sha256") = 64 and "snapshot_sha256" not glob '*[^a-f0-9]*' and length("pdf_sha256") = 64 and "pdf_sha256" not glob '*[^a-f0-9]*' and length("evidence_sha256") = 64 and "evidence_sha256" not glob '*[^a-f0-9]*'),
	CONSTRAINT "quote_signatures_evidence_check" CHECK(typeof("evidence_content") = 'blob' and length("evidence_content") between 1 and 65536)
);
--> statement-breakpoint
ALTER TABLE `quote_links` ADD `usage_policy` text DEFAULT 'single-use' NOT NULL;--> statement-breakpoint
ALTER TABLE `quote_links` ADD `consumed_at` integer;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_quote_links` (
	`id` text PRIMARY KEY,
	`revision_id` text NOT NULL,
	`token_hmac` blob NOT NULL,
	`usage_policy` text DEFAULT 'single-use' NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer,
	`consumed_at` integer,
	CONSTRAINT `fk_quote_links_revision_id_quote_revisions_id_fk` FOREIGN KEY (`revision_id`) REFERENCES `quote_revisions`(`id`) ON DELETE CASCADE,
	CONSTRAINT "quote_links_id_ulid_check" CHECK("id" is not null and length("id") = 26 and "id" not glob '*[^0-9A-HJKMNP-TV-Z]*' and substr("id", 1, 1) between '0' and '7'),
	CONSTRAINT "quote_links_token_hmac_check" CHECK(typeof("token_hmac") = 'blob' and length("token_hmac") = 32),
	CONSTRAINT "quote_links_expiry_check" CHECK("expires_at" > "created_at"),
	CONSTRAINT "quote_links_usage_policy_check" CHECK("usage_policy" = 'single-use'),
	CONSTRAINT "quote_links_terminal_timestamps_check" CHECK(("revoked_at" is null or "revoked_at" >= "created_at") and ("consumed_at" is null or "consumed_at" >= "created_at"))
);
--> statement-breakpoint
INSERT INTO `__new_quote_links`(`id`, `revision_id`, `token_hmac`, `created_at`, `expires_at`, `revoked_at`) SELECT `id`, `revision_id`, `token_hmac`, `created_at`, `expires_at`, `revoked_at` FROM `quote_links`;--> statement-breakpoint
DROP TABLE `quote_links`;--> statement-breakpoint
ALTER TABLE `__new_quote_links` RENAME TO `quote_links`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `quote_links_token_hmac_unique` ON `quote_links` (`token_hmac`);--> statement-breakpoint
CREATE INDEX `quote_links_revision_id_index` ON `quote_links` (`revision_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_quote_id_unique` ON `orders` (`quote_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_revision_id_unique` ON `orders` (`revision_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `orders_signature_id_unique` ON `orders` (`signature_id`);--> statement-breakpoint
CREATE INDEX `orders_client_id_index` ON `orders` (`client_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `quote_signatures_quote_id_unique` ON `quote_signatures` (`quote_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `quote_signatures_revision_id_unique` ON `quote_signatures` (`revision_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `quote_signatures_link_id_unique` ON `quote_signatures` (`link_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `quote_signatures_audit_event_id_unique` ON `quote_signatures` (`audit_event_id`);